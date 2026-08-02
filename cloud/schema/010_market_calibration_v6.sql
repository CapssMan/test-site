-- Reproducible desired version pointers for the market-calibrated v6 release.
UPSERT INTO active_bank_versions (test_id, bank_version, updated_at) VALUES
    (Utf8("fa-junior"), Utf8("FA Junior v6.0"), CurrentUtcTimestamp()),
    (Utf8("ca-junior"), Utf8("CA Junior v6.0"), CurrentUtcTimestamp()),
    (Utf8("fpa-junior"), Utf8("FP&A Junior v6.0"), CurrentUtcTimestamp()),
    (Utf8("acc-junior"), Utf8("ACC Junior v6.0"), CurrentUtcTimestamp()),
    (Utf8("bi-junior"), Utf8("BI Junior v6.0"), CurrentUtcTimestamp());
