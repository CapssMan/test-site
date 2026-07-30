-- Activated only after the v5 private artifacts are uploaded and verified.
UPSERT INTO active_bank_versions (test_id, bank_version, updated_at) VALUES
    (Utf8("fa-junior"), Utf8("FA Junior v5.0"), CurrentUtcTimestamp()),
    (Utf8("ca-junior"), Utf8("CA Junior v5.0"), CurrentUtcTimestamp()),
    (Utf8("fpa-junior"), Utf8("FP&A Junior v5.0"), CurrentUtcTimestamp()),
    (Utf8("acc-junior"), Utf8("ACC Junior v5.0"), CurrentUtcTimestamp()),
    (Utf8("bi-junior"), Utf8("BI Junior v5.0"), CurrentUtcTimestamp());
