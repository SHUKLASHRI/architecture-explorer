"""Unit and integration test suite for Architecture Explorer backend."""

from __future__ import annotations

import os
import shutil
import tempfile
import unittest
import networkx as nx

from app import app
from backend.analyzer import find_circular_dependencies, find_dead_functions, impact_analysis
from backend.project_mapper import ProjectArchitectureMapper, calculate_complexity
from backend.project_service import ProjectService
from backend.refactor import apply_rename, plan_rename, verify_plan

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAMPLE_PROJECT = os.path.join(REPO_ROOT, "sample_project")


class TestProjectMapper(unittest.TestCase):
    def setUp(self):
        self.mapper = ProjectArchitectureMapper(SAMPLE_PROJECT)
        self.result = self.mapper.generate_project_map()

    def test_project_scan_meta(self):
        summary = self.result["summary"]
        self.assertEqual(summary["total_files"], 4)
        self.assertGreater(summary["total_lines"], 50)
        self.assertGreater(summary["total_nodes"], 10)
        self.assertGreater(summary["total_edges"], 5)

    def test_node_attributes(self):
        nodes = {n["id"]: n for n in self.result["nodes"]}
        self.assertIn("auth::validate_user", nodes)
        fn_node = nodes["auth::validate_user"]
        self.assertEqual(fn_node["name"], "validate_user")
        self.assertEqual(fn_node["kind"], "function")
        self.assertIn("line", fn_node)
        self.assertIn("col", fn_node)
        self.assertIn("file", fn_node)
        self.assertTrue(os.path.isabs(fn_node["file"]))

    def test_layers_classification(self):
        layers = self.result["layers"]
        self.assertIn("presentation", layers)
        self.assertIn("persistence", layers)
        self.assertIn("services", layers)
        self.assertGreater(len(layers["persistence"]), 0)

    def test_coupling_metrics(self):
        diagnostics = self.result["diagnostics"]
        coupling = diagnostics["coupling_metrics"]
        self.assertIn("auth", coupling)
        self.assertIn("afferent_coupling_ca", coupling["auth"])
        self.assertIn("efferent_coupling_ce", coupling["auth"])
        self.assertIn("instability_metric", coupling["auth"])


class TestAnalyzer(unittest.TestCase):
    def test_circular_dependency_detection(self):
        G = nx.DiGraph()
        G.add_edge("a", "b", type="calls")
        G.add_edge("b", "c", type="calls")
        G.add_edge("c", "a", type="calls")
        G.add_edge("x", "y", type="calls")

        cycles = find_circular_dependencies(G)
        self.assertEqual(len(cycles), 1)
        self.assertEqual(sorted(cycles[0]), ["a", "b", "c"])

    def test_dead_functions_detection(self):
        G = nx.DiGraph()
        G.add_node("mod::dead_fn", kind="function", name="dead_fn", file="mod.py", line=10)
        G.add_node("mod::live_fn", kind="function", name="live_fn", file="mod.py", line=20)
        G.add_node("mod::main", kind="function", name="main", file="mod.py", line=30)
        G.add_edge("mod::caller", "mod::live_fn", type="calls")

        dead = find_dead_functions(G)
        dead_ids = [d["id"] for d in dead]
        self.assertIn("mod::dead_fn", dead_ids)
        self.assertNotIn("mod::live_fn", dead_ids)
        self.assertNotIn("mod::main", dead_ids)

    def test_impact_analysis(self):
        G = nx.DiGraph()
        G.add_edge("entry", "service", type="calls")
        G.add_edge("service", "repo", type="calls")
        G.add_edge("repo", "db", type="calls")

        impact = impact_analysis(G, "service")
        self.assertEqual(impact["direct_callers"], ["entry"])
        self.assertEqual(impact["direct_callees"], ["repo"])
        self.assertEqual(impact["callers"], ["entry"])
        self.assertEqual(sorted(impact["callees"]), ["db", "repo"])


class TestRefactoring(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.sample_file = os.path.join(self.temp_dir, "calc.py")
        with open(self.sample_file, "w", encoding="utf-8") as f:
            f.write("def add(a, b):\n    return a + b\n\ndef run():\n    return add(1, 2)\n")

        mapper = ProjectArchitectureMapper(self.temp_dir)
        self.map_res = mapper.generate_project_map()
        self.G = self.map_res["graph"]

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_plan_and_apply_rename(self):
        plan = plan_rename(self.G, target_node_id="calc::add", new_name="add_numbers")
        self.assertTrue(plan["ok"])
        self.assertEqual(len(plan["substitutions"]), 2)

        verification = verify_plan(plan)
        self.assertTrue(verification["ok"])

        apply_res = apply_rename(plan)
        self.assertTrue(apply_res["success"])

        with open(self.sample_file, "r", encoding="utf-8") as f:
            updated_content = f.read()

        self.assertIn("def add_numbers(a, b):", updated_content)
        self.assertIn("return add_numbers(1, 2)", updated_content)
        self.assertNotIn("def add(", updated_content)

    def test_reject_invalid_identifier(self):
        plan = plan_rename(self.G, target_node_id="calc::add", new_name="123_invalid")
        self.assertFalse(plan["ok"])
        self.assertIn("not a valid Python identifier", plan["error"])

    def test_reject_keyword(self):
        plan = plan_rename(self.G, target_node_id="calc::add", new_name="def")
        self.assertFalse(plan["ok"])


class TestProjectService(unittest.TestCase):
    def setUp(self):
        self.service = ProjectService(repo_root=REPO_ROOT)

    def test_path_traversal_rejection(self):
        root = self.service.resolve_project_root("sample_project")
        with self.assertRaises(PermissionError):
            self.service.resolve_safe_file_path(root, "../../app.py")

    def test_source_snippet(self):
        snippet = self.service.get_source_snippet("sample_project", "auth.py", 10, context=2)
        self.assertIn("lines", snippet)
        self.assertEqual(snippet["target_line"], 10)
        self.assertTrue(any(l["is_target"] for l in snippet["lines"]))

    def test_file_save_with_syntax_validation(self):
        temp_dir = tempfile.mkdtemp()
        try:
            svc = ProjectService(repo_root=temp_dir)
            target = os.path.join(temp_dir, "test.py")

            # Valid syntax
            res1 = svc.save_file_content(temp_dir, "test.py", "x = 42\n")
            self.assertTrue(res1["success"])

            # Invalid syntax
            res2 = svc.save_file_content(temp_dir, "test.py", "def broken(\n")
            self.assertFalse(res2["success"])
            self.assertIn("syntax_error", res2)
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)


class TestFlaskAPI(unittest.TestCase):
    def setUp(self):
        app.config["TESTING"] = True
        self.client = app.test_client()

    def test_health_endpoint(self):
        res = self.client.get("/health")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["status"], "ok")

    def test_analyze_endpoint(self):
        res = self.client.post("/analyze", json={"project_path": "sample_project"})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("project", data)
        self.assertIn("nodes", data)
        self.assertIn("edges", data)
        self.assertIn("summary", data)

    def test_source_security_enforcement(self):
        res = self.client.get("/source?file=../../app.py&project_path=sample_project")
        self.assertEqual(res.status_code, 403)
        data = res.get_json()
        self.assertIn("Access denied", data["error"])

    def test_circular_deps_endpoint(self):
        res = self.client.post("/analyze/circular-deps", json={"project_path": "sample_project"})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("cycles", data)

    def test_dead_code_endpoint(self):
        res = self.client.post("/analyze/dead-code", json={"project_path": "sample_project"})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("dead_functions", data)

    def test_impact_endpoint(self):
        res = self.client.get("/analyze/impact?node=auth::validate_user&project_path=sample_project")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["node"], "auth::validate_user")
        self.assertIn("callers", data)
        self.assertIn("callees", data)

    def test_rename_preview_endpoint(self):
        res = self.client.post(
            "/refactor/rename/preview",
            json={
                "project_path": "sample_project",
                "node_id": "auth::validate_user",
                "new_name": "check_user",
            },
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["ok"])
        self.assertIn("substitutions", data)


if __name__ == "__main__":
    unittest.main()
