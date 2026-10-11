"""
Pytest configuration and isolation fixtures.
"""

import os
import pytest
from pathlib import Path


@pytest.fixture(scope="session", autouse=True)
def isolate_test_db(tmp_path_factory):
    """
    Ensure all tests run against an isolated temporary database file,
    preventing any test execution from modifying data/app.db.
    """
    temp_dir = tmp_path_factory.mktemp("wte_test_session")
    temp_db_file = temp_dir / "test_app.db"

    old_env = os.environ.get("WTE_DB_PATH")
    os.environ["WTE_DB_PATH"] = str(temp_db_file)

    yield temp_db_file

    if old_env is not None:
        os.environ["WTE_DB_PATH"] = old_env
    else:
        os.environ.pop("WTE_DB_PATH", None)
