#!/usr/bin/env python3
"""
Backward-compatible entry point. Prefer `python main.py`.
"""

from main import run_etl_pipeline

if __name__ == "__main__":
    run_etl_pipeline()
