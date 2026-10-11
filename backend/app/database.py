"""
Database Persistence Module for Simulation History
===================================================
SQLAlchemy schema + aiosqlite asynchronous persistence layer.
Database file stored at data/app.db.
"""

import os
import json
from pathlib import Path
from typing import Optional, List, Tuple, Dict, Any

import aiosqlite
from sqlalchemy import Table, Column, String, Text, MetaData, select, insert, func, desc
from sqlalchemy.schema import CreateTable
from sqlalchemy.dialects import sqlite

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DATA_DIR = PROJECT_ROOT / "data"
DB_PATH = DATA_DIR / "app.db"

# Schema definition using SQLAlchemy Core
metadata = MetaData()
sqlite_dialect = sqlite.dialect(paramstyle="named")

history_table = Table(
    "simulation_history",
    metadata,
    Column("id", String(64), primary_key=True, index=True),
    Column("timestamp", String(64), index=True),
    Column("scenario_name", String(128)),
    Column("anomaly_state", String(64)),
    Column("parameters_json", Text),
    Column("overall_json", Text),
    Column("full_result_json", Text, nullable=True),
)


def get_db_path() -> Path:
    """Ensure parent directory exists and return DB path.
    Reads WTE_DB_PATH from environment at call time, falling back to data/app.db.
    """
    env_path = os.environ.get("WTE_DB_PATH")
    if env_path:
        db_path = Path(env_path).resolve()
    else:
        db_path = (PROJECT_ROOT / "data" / "app.db").resolve()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    return db_path


async def get_connection() -> aiosqlite.Connection:
    """Open and return a connection to data/app.db."""
    path = get_db_path()
    db = await aiosqlite.connect(str(path))
    db.row_factory = aiosqlite.Row
    return db


_initialized_dbs = set()


async def ensure_db_initialized() -> None:
    """Ensure database schema is created for the currently configured DB path."""
    path_str = str(get_db_path())
    if path_str not in _initialized_dbs:
        await init_db()
        _initialized_dbs.add(path_str)


async def init_db() -> None:
    """Initialize database and create tables if not present."""
    path = get_db_path()
    create_sql = str(CreateTable(history_table, if_not_exists=True).compile(dialect=sqlite_dialect))
    db = await get_connection()
    try:
        await db.execute(create_sql)
        # Create index on timestamp if not exists
        await db.execute(
            "CREATE INDEX IF NOT EXISTS ix_simulation_history_timestamp ON simulation_history (timestamp DESC)"
        )
        await db.commit()
        _initialized_dbs.add(str(path))
    finally:
        await db.close()


def _row_to_dict(row: aiosqlite.Row) -> Dict[str, Any]:
    """Convert database row to history dictionary format."""
    params = {}
    overall = {}
    if row["parameters_json"]:
        try:
            params = json.loads(row["parameters_json"])
        except Exception:
            params = {}
    if row["overall_json"]:
        try:
            overall = json.loads(row["overall_json"])
        except Exception:
            overall = {}

    # Ensure net_power_kw and electrical_output_kw consistency
    if "net_power_kw" not in overall and "electrical_output_kw" in overall:
        overall["net_power_kw"] = overall["electrical_output_kw"]
    if "electrical_output_kw" not in overall and "net_power_kw" in overall:
        overall["electrical_output_kw"] = overall["net_power_kw"]
    if "cold_gas_efficiency_pct" not in overall and "gasification_efficiency_pct" in overall:
        overall["cold_gas_efficiency_pct"] = overall["gasification_efficiency_pct"]
    if "gasification_efficiency_pct" not in overall and "cold_gas_efficiency_pct" in overall:
        overall["gasification_efficiency_pct"] = overall["cold_gas_efficiency_pct"]

    return {
        "id": row["id"],
        "scenario_id": row["id"],
        "timestamp": row["timestamp"],
        "scenario_name": row["scenario_name"],
        "parameters": params,
        "overall": overall,
        "anomaly_state": row["anomaly_state"],
    }


async def add_history_record(entry: Dict[str, Any], full_result: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Insert a simulation run entry into the database."""
    await ensure_db_initialized()
    get_db_path()
    values = {
        "id": str(entry["id"]),
        "timestamp": str(entry.get("timestamp", "")),
        "scenario_name": str(entry.get("scenario_name", "Custom Scenario")),
        "anomaly_state": str(entry.get("anomaly_state", "NORMAL_FLUIDIZATION")),
        "parameters_json": json.dumps(entry.get("parameters", {})),
        "overall_json": json.dumps(entry.get("overall", {})),
        "full_result_json": json.dumps(full_result) if full_result else None,
    }

    # Use SQLite INSERT OR REPLACE to be idempotent
    sql = (
        "INSERT OR REPLACE INTO simulation_history "
        "(id, timestamp, scenario_name, anomaly_state, parameters_json, overall_json, full_result_json) "
        "VALUES (:id, :timestamp, :scenario_name, :anomaly_state, :parameters_json, :overall_json, :full_result_json)"
    )

    db = await get_connection()
    try:
        await db.execute(sql, values)
        await db.commit()
    finally:
        await db.close()

    return {
        "id": values["id"],
        "timestamp": values["timestamp"],
        "scenario_name": values["scenario_name"],
        "parameters": entry.get("parameters", {}),
        "overall": entry.get("overall", {}),
        "anomaly_state": values["anomaly_state"],
    }


async def get_history_records(limit: int = 100, offset: int = 0) -> Tuple[List[Dict[str, Any]], int]:
    """Retrieve history records ordered by timestamp descending with pagination."""
    await ensure_db_initialized()
    get_db_path()
    db = await get_connection()
    try:
        # Get total count
        count_query = select(func.count(history_table.c.id))
        compiled_count = count_query.compile(dialect=sqlite_dialect)
        async with db.execute(str(compiled_count), compiled_count.params) as cursor:
            count_row = await cursor.fetchone()
            total = count_row[0] if count_row else 0

        # Select paginated records
        sel_query = (
            select(history_table)
            .order_by(desc(history_table.c.timestamp))
            .limit(limit)
            .offset(offset)
        )
        compiled_sel = sel_query.compile(dialect=sqlite_dialect)
        async with db.execute(str(compiled_sel), compiled_sel.params) as cursor:
            rows = await cursor.fetchall()
            items = [_row_to_dict(r) for r in rows]

        return items, total
    finally:
        await db.close()


async def get_history_record_by_id(sim_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve single simulation record by id with full result if available."""
    await ensure_db_initialized()
    get_db_path()
    sel_query = select(history_table).where(history_table.c.id == sim_id)
    compiled_sel = sel_query.compile(dialect=sqlite_dialect)
    db = await get_connection()
    try:
        async with db.execute(str(compiled_sel), compiled_sel.params) as cursor:
            row = await cursor.fetchone()
            if not row:
                return None
            if row["full_result_json"]:
                try:
                    res = json.loads(row["full_result_json"])
                    res["id"] = row["id"]
                    res["scenario_id"] = row["id"]
                    if "overall" in res and isinstance(res["overall"], dict):
                        if "net_power_kw" not in res["overall"] and "electrical_output_kw" in res["overall"]:
                            res["overall"]["net_power_kw"] = res["overall"]["electrical_output_kw"]
                        if "electrical_output_kw" not in res["overall"] and "net_power_kw" in res["overall"]:
                            res["overall"]["electrical_output_kw"] = res["overall"]["net_power_kw"]
                        if "cold_gas_efficiency_pct" not in res["overall"] and "gasification_efficiency_pct" in res["overall"]:
                            res["overall"]["cold_gas_efficiency_pct"] = res["overall"]["gasification_efficiency_pct"]
                        if "gasification_efficiency_pct" not in res["overall"] and "cold_gas_efficiency_pct" in res["overall"]:
                            res["overall"]["gasification_efficiency_pct"] = res["overall"]["cold_gas_efficiency_pct"]
                    return res
                except Exception:
                    pass
            d = _row_to_dict(row)
            d["id"] = row["id"]
            d["scenario_id"] = row["id"]
            return d
    finally:
        await db.close()


async def count_history_records() -> int:
    """Return total number of history records."""
    await ensure_db_initialized()
    get_db_path()
    count_query = select(func.count(history_table.c.id))
    compiled_count = count_query.compile(dialect=sqlite_dialect)
    db = await get_connection()
    try:
        async with db.execute(str(compiled_count), compiled_count.params) as cursor:
            count_row = await cursor.fetchone()
            return count_row[0] if count_row else 0
    finally:
        await db.close()


async def close_db() -> None:
    """No-op for connection-per-request pattern, provided for interface completeness."""
    pass
