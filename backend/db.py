"""MariaDB connection and schema helpers."""
from __future__ import annotations

from contextlib import AbstractContextManager
from typing import Any

import pymysql
from pymysql.cursors import DictCursor

from backend.config import settings


DB_CONFIG = {
    "host": settings.db_host,
    "port": settings.db_port,
    "user": settings.db_user,
    "password": settings.db_password,
    "database": settings.db_name,
    "charset": "utf8mb4",
    "cursorclass": DictCursor,
    "autocommit": False,
    "connect_timeout": 5,
}


class DatabaseSession(AbstractContextManager):
    """Small adapter that gives PyMySQL a convenient execute/fetch API."""

    def __init__(self, config: dict[str, Any] | None = None):
        """Open a MariaDB connection using the app or supplied configuration."""
        self.connection = pymysql.connect(**(config or DB_CONFIG))

    def execute(self, sql: str, params: tuple | list | None = None):
        """Execute one parameterized SQL statement and return its cursor."""
        cursor = self.connection.cursor()
        cursor.execute(sql.replace("?", "%s"), params or ())
        return cursor

    def executemany(self, sql: str, rows):
        """Execute a parameterized SQL statement for each row in a batch."""
        cursor = self.connection.cursor()
        cursor.executemany(sql.replace("?", "%s"), rows)
        return cursor

    def __enter__(self):
        """Return this session for use as a transaction context manager."""
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        """Commit successful work, roll back failures, and close the connection."""
        try:
            if exc_type:
                self.connection.rollback()
            else:
                self.connection.commit()
        finally:
            self.connection.close()
        return False

    def begin(self) -> None:
        """Begin an explicit transaction before a read-modify-write operation."""
        self.connection.begin()


def connect() -> DatabaseSession:
    """Create a configured MariaDB session."""
    return DatabaseSession()


def initialize() -> None:
    """Create application tables and add fields missing from older schemas."""
    with connect() as db:
        db.execute("""CREATE TABLE IF NOT EXISTS employees (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            employee_code VARCHAR(32) NOT NULL UNIQUE,
            first_name VARCHAR(80) NOT NULL,
            last_name VARCHAR(80) NOT NULL,
            email VARCHAR(190) NOT NULL UNIQUE,
            country VARCHAR(100) NOT NULL,
            department VARCHAR(100) NOT NULL,
            job_title VARCHAR(120) NOT NULL,
            employment_status VARCHAR(24) NOT NULL DEFAULT 'Active',
            created_at VARCHAR(32) NOT NULL,
            KEY idx_employees_country (country),
            KEY idx_employees_department (department),
            KEY idx_employees_title (job_title),
            KEY idx_employees_status (employment_status),
            KEY idx_employees_name (last_name, first_name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci""")
        employee_columns = {row["Field"] for row in db.execute("SHOW COLUMNS FROM employees")}
        if "employment_status" not in employee_columns:
            db.execute("ALTER TABLE employees ADD COLUMN employment_status VARCHAR(24) NOT NULL DEFAULT 'Active'")
        if "created_at" not in employee_columns:
            db.execute("ALTER TABLE employees ADD COLUMN created_at VARCHAR(32) NOT NULL DEFAULT ''")
        db.execute("""CREATE TABLE IF NOT EXISTS salary_records (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            employee_id BIGINT UNSIGNED NOT NULL,
            previous_salary_minor BIGINT UNSIGNED NULL,
            previous_currency CHAR(3) NULL,
            new_salary_minor BIGINT UNSIGNED NOT NULL,
            currency CHAR(3) NOT NULL,
            effective_date DATE NOT NULL,
            reason VARCHAR(500) NOT NULL,
            changed_by VARCHAR(120) NOT NULL,
            changed_at VARCHAR(32) NOT NULL,
            CONSTRAINT fk_salary_records_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
            UNIQUE KEY uq_salary_record_effective_date (employee_id, effective_date),
            KEY idx_salary_records_current (employee_id, effective_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci""")
