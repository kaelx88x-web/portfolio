"""Pure plate-membership logic for /quotes/plate-membership — no OpenD/SDK needed.

Run: python -m unittest moomoo-service/tests/test_plate_logic.py
Also runs under pytest if available.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from plate_logic import (  # noqa: E402
    chunk_codes,
    group_plate_membership,
    collect_plate_membership,
)


class TestChunkCodes(unittest.TestCase):
    def test_batches_respect_max_size(self):
        codes = [f"US.S{i}" for i in range(450)]
        chunks = chunk_codes(codes, 200)
        self.assertEqual([len(c) for c in chunks], [200, 200, 50])
        self.assertTrue(all(len(c) <= 200 for c in chunks))

    def test_empty_input(self):
        self.assertEqual(chunk_codes([], 200), [])


class TestGroupPlateMembership(unittest.TestCase):
    def test_keeps_only_industry_and_concept(self):
        rows = [
            {"code": "US.NVDA", "plate_code": "US.IND01", "plate_name": "Semis", "plate_type": "INDUSTRY"},
            {"code": "US.NVDA", "plate_code": "US.CON01", "plate_name": "AI", "plate_type": "CONCEPT"},
            {"code": "US.NVDA", "plate_code": "US.REG01", "plate_name": "USA", "plate_type": "REGION"},
        ]
        out = group_plate_membership(rows)
        self.assertEqual(len(out["US.NVDA"]), 2)
        self.assertEqual({p["plate_type"] for p in out["US.NVDA"]}, {"INDUSTRY", "CONCEPT"})

    def test_reads_plate_class_alias(self):
        rows = [{"code": "us.amd", "plate_code": "US.IND01", "plate_name": "Semis", "plate_class": "industry"}]
        out = group_plate_membership(rows)
        self.assertEqual(out["US.AMD"][0]["plate_code"], "US.IND01")
        self.assertEqual(out["US.AMD"][0]["plate_type"], "INDUSTRY")

    def test_skips_rows_without_code_or_plate(self):
        rows = [{"code": "", "plate_code": "X", "plate_type": "INDUSTRY"},
                {"code": "US.X", "plate_code": "", "plate_type": "INDUSTRY"}]
        self.assertEqual(group_plate_membership(rows), {})


class TestCollectPlateMembership(unittest.TestCase):
    def test_splits_batch_to_skip_unsupported_code(self):
        calls = []

        def fetch_fn(batch):
            calls.append(list(batch))
            if "US.BAD" in batch and len(batch) > 1:
                return (False, [])  # whole chunk fails while BAD is present
            if batch == ["US.BAD"]:
                return (False, [])  # single bad code -> skipped
            return (True, [{"code": c, "plate_code": "US.IND01", "plate_name": "Semis",
                            "plate_type": "INDUSTRY"} for c in batch])

        membership = collect_plate_membership(fetch_fn, ["US.NVDA", "US.BAD", "US.AMD"])
        self.assertIn("US.NVDA", membership)
        self.assertIn("US.AMD", membership)
        self.assertNotIn("US.BAD", membership)

    def test_never_requests_more_than_max_per_call(self):
        calls = []

        def fetch_fn(batch):
            calls.append(list(batch))
            return (True, [{"code": c, "plate_code": "US.IND01", "plate_name": "Semis",
                            "plate_type": "INDUSTRY"} for c in batch])

        codes = [f"US.S{i}" for i in range(250)]
        collect_plate_membership(fetch_fn, codes, max_per_req=200)
        self.assertTrue(all(len(c) <= 200 for c in calls))
        self.assertEqual(sum(len(c) for c in calls), 250)


if __name__ == "__main__":
    unittest.main()
