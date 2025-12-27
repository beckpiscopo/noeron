import json
import sys
import tempfile
import unittest
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from agents.verification_agent import VerificationAgent


class DummyVectorStore:
    def __init__(self, mapping):
        self.mapping = mapping

    def search(self, query, n_results=5):
        paper_ids = self.mapping.get(query, [])
        metadatas = [[{"paper_id": pid} for pid in paper_ids]]
        return {"metadatas": metadatas}


class VerificationAgentTests(unittest.TestCase):
    def setUp(self):
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp_dir.cleanup)
        self._create_sample_corpus()
        self.agent = VerificationAgent(cleaned_papers_dir=self.tmp_dir.name)
        self.podcast_date = datetime(2025, 1, 1)

    def _create_sample_corpus(self):
        samples = {
            "recent": {
                "paper_id": "recent",
                "title": "Recent Work",
                "year": 2024,
                "citations": [],
                "references": [],
            },
            "other": {
                "paper_id": "other",
                "title": "Related Work",
                "year": 2023,
                "citations": [],
                "references": [{"paper_id": "recent"}],
            },
            "old": {
                "paper_id": "old",
                "title": "Older Findings",
                "year": 2018,
                "citations": [],
                "references": [],
            },
            "future": {
                "paper_id": "future",
                "title": "Future Paper",
                "year": 2026,
                "citations": [],
                "references": [],
            },
        }
        for name, payload in samples.items():
            path = Path(self.tmp_dir.name) / f"{name}.json"
            path.write_text(json.dumps(payload))

    def test_high_confidence_match(self):
        claim_text = "This recent work on planaria feels transformative."
        vector_store = DummyVectorStore({claim_text: ["other"]})
        result = self.agent.verify_match(
            claim_data={"claim_text": claim_text},
            matched_paper_id="recent",
            vector_store=vector_store,
            context={"podcast_date": self.podcast_date},
        )

        self.assertTrue(result["verified"])
        self.assertEqual(result["flags"], [])
        self.assertGreaterEqual(result["confidence"], 0.5)
        self.assertIn("citation_network", result["details"])

    def test_low_confidence_stale_match(self):
        claim_text = "This recent work proves my point."
        vector_store = DummyVectorStore({claim_text: ["other"]})
        result = self.agent.verify_match(
            claim_data={"claim_text": claim_text},
            matched_paper_id="old",
            vector_store=vector_store,
            context={"podcast_date": self.podcast_date},
        )

        expected_flags = {"STALE_REFERENCE", "NO_CITATION_SUPPORT", "ISOLATED_MATCH", "LOW_CONFIDENCE"}
        self.assertFalse(result["verified"])
        self.assertSetEqual(set(result["flags"]), expected_flags)
        self.assertLess(result["confidence"], 0.5)

    def test_future_match_is_flagged(self):
        claim_text = "Tomorrow’s work will rewrite the biology textbooks."
        vector_store = DummyVectorStore({claim_text: []})
        result = self.agent.verify_match(
            claim_data={"claim_text": claim_text},
            matched_paper_id="future",
            vector_store=vector_store,
            context={"podcast_date": self.podcast_date},
        )

        self.assertFalse(result["verified"])
        self.assertIn("FUTURE_PAPER", result["flags"])
        self.assertIn("LOW_CONFIDENCE", result["flags"])
        self.assertLess(result["confidence"], 0.5)


if __name__ == "__main__":
    unittest.main()

