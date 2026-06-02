"""Layer 1 (Python) — bridge option math for /paper-trading options (audit §9).

Verifies collateral, assignment risk, max loss, and the candidate screen WITHOUT
OpenD / the moomoo SDK. Grounding: 100-share contract multiplier; CSP collateral
= strike*100; covered call needs 100 shares/contract; long-option max loss = debit
paid; delta band [0.20, 0.45].

Run (no extra deps): python -m unittest moomoo-service/tests/test_options.py
Also runs under pytest if available.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from options_logic import (  # noqa: E402
    option_mid,
    put_collateral,
    covered_call_shares_required,
    covered_call_collateral_value,
    premium_yield_pct,
    long_option_max_loss,
    csp_max_loss_if_assigned,
    vertical_spread_max_loss,
    vertical_spread_max_profit,
    in_delta_band,
    candidate_strategy,
    assignment_risk,
    enrich_candidate,
)


class TestCollateral(unittest.TestCase):
    def test_csp_collateral_is_strike_times_100(self):
        self.assertEqual(put_collateral(5.50), 550.0)
        self.assertEqual(put_collateral(100), 10_000.0)

    def test_csp_collateral_scales_with_contracts(self):
        self.assertEqual(put_collateral(10, contracts=3), 3_000.0)

    def test_covered_call_requires_100_shares_per_contract(self):
        self.assertEqual(covered_call_shares_required(), 100)
        self.assertEqual(covered_call_shares_required(2), 200)

    def test_covered_call_collateral_value_uses_underlying(self):
        self.assertEqual(covered_call_collateral_value(5.44), 544.0)


class TestPricing(unittest.TestCase):
    def test_mid_is_average_of_bid_ask(self):
        self.assertEqual(option_mid(0.50, 0.60), 0.55)

    def test_mid_falls_back_to_bid_when_ask_missing(self):
        self.assertEqual(option_mid(0.50, 0.0), 0.50)
        self.assertEqual(option_mid(0.50, None), 0.50)

    def test_premium_yield_pct(self):
        self.assertEqual(premium_yield_pct(0.55, 5.50), 10.0)

    def test_premium_yield_none_when_strike_zero(self):
        self.assertIsNone(premium_yield_pct(0.55, 0))


class TestMaxLoss(unittest.TestCase):
    def test_long_option_max_loss_is_premium_paid(self):
        # pay $1.20/share → max loss $120/contract
        self.assertEqual(long_option_max_loss(1.20), 120.0)

    def test_csp_max_loss_if_assigned(self):
        # assigned at 5.50, kept 0.55 premium → (5.50-0.55)*100 = 495
        self.assertEqual(csp_max_loss_if_assigned(5.50, 0.55), 495.0)

    def test_csp_max_loss_floored_at_zero(self):
        self.assertEqual(csp_max_loss_if_assigned(1.0, 5.0), 0.0)

    def test_debit_spread_max_loss_and_profit(self):
        # $5 wide, $2 debit → max loss 200, max profit 300
        self.assertEqual(vertical_spread_max_loss(5, 2, is_debit=True), 200.0)
        self.assertEqual(vertical_spread_max_profit(5, 2, is_debit=True), 300.0)

    def test_credit_spread_max_loss_and_profit(self):
        # $5 wide, $1.50 credit → max profit 150, max loss 350
        self.assertEqual(vertical_spread_max_profit(5, 1.50, is_debit=False), 150.0)
        self.assertEqual(vertical_spread_max_loss(5, 1.50, is_debit=False), 350.0)


class TestDeltaBand(unittest.TestCase):
    def test_band_inclusive_bounds(self):
        self.assertTrue(in_delta_band(0.20))
        self.assertTrue(in_delta_band(0.45))
        self.assertTrue(in_delta_band(-0.30))  # puts have negative delta

    def test_band_excludes_outside(self):
        self.assertFalse(in_delta_band(0.10))
        self.assertFalse(in_delta_band(0.60))
        self.assertFalse(in_delta_band(0.0))
        self.assertFalse(in_delta_band(None))


class TestCandidateStrategy(unittest.TestCase):
    def test_call_in_band_is_covered_call(self):
        self.assertEqual(candidate_strategy("CALL", 0.30, "both"), "covered_call")

    def test_put_in_band_is_cash_secured_put(self):
        self.assertEqual(candidate_strategy("PUT", -0.30, "both"), "cash_secured_put")

    def test_mode_filters_strategy(self):
        self.assertIsNone(candidate_strategy("PUT", -0.30, "cc"))
        self.assertIsNone(candidate_strategy("CALL", 0.30, "csp"))

    def test_out_of_band_is_none(self):
        self.assertIsNone(candidate_strategy("CALL", 0.05, "both"))


class TestAssignmentRisk(unittest.TestCase):
    def test_itm_call_is_high(self):
        self.assertEqual(assignment_risk("call", underlying_price=6.0, strike=5.5), "high")

    def test_itm_put_is_high(self):
        self.assertEqual(assignment_risk("put", underlying_price=5.0, strike=5.5), "high")

    def test_near_money_is_moderate(self):
        # within 2% of strike, not ITM
        self.assertEqual(assignment_risk("call", underlying_price=5.45, strike=5.50), "moderate")

    def test_far_otm_is_low(self):
        self.assertEqual(assignment_risk("call", underlying_price=4.0, strike=5.5), "low")

    def test_unknown_without_underlying(self):
        self.assertEqual(assignment_risk("call", underlying_price=0, strike=5.5), "unknown")


class TestEnrichCandidate(unittest.TestCase):
    def test_csp_enrichment_has_collateral_and_max_loss(self):
        row = {"strategy": "cash_secured_put", "strike": 5.50, "mid": 0.55}
        out = enrich_candidate(row, underlying_price=5.40)
        self.assertEqual(out["collateral_per_contract"], 550.0)
        self.assertEqual(out["max_loss_per_contract"], 495.0)
        self.assertEqual(out["assignment_risk"], "high")  # underlying < strike → ITM put
        self.assertIsNone(out["shares_required"])

    def test_cc_enrichment_requires_shares_and_shows_assignment(self):
        row = {"strategy": "covered_call", "strike": 5.50, "mid": 0.40}
        out = enrich_candidate(row, underlying_price=5.00)
        self.assertEqual(out["shares_required"], 100)
        self.assertEqual(out["underlying_collateral_value"], 500.0)
        # underlying 5.00 vs strike 5.50 → ~9% OTM call → low assignment risk
        self.assertEqual(out["assignment_risk"], "low")


if __name__ == "__main__":
    unittest.main()
