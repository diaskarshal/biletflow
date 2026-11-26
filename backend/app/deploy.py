"""Deployment commands, run explicitly against the selected environment."""

import argparse
import os
from pathlib import Path

from dotenv import load_dotenv


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", type=Path, help="Load deployment secrets from an ignored file")
    parser.add_argument("command", choices=("check", "migrate", "seed", "prepare"))
    args = parser.parse_args()
    if args.env_file:
        if not args.env_file.is_file():
            parser.error("The environment file does not exist")
        load_dotenv(args.env_file, override=True)

    from alembic import command
    from alembic.config import Config
    from alembic.migration import MigrationContext
    from alembic.script import ScriptDirectory
    from sqlalchemy import text

    from app.db.session import engine

    config = Config()
    config.set_main_option("script_location", str(Path(__file__).parent / "db" / "migrations"))
    if args.command in ("migrate", "prepare"):
        command.upgrade(config, "head")
        print("Database migrations applied.")
        if args.command == "prepare" and os.environ.get("SEED_DEMO") == "1":
            from app.db.seed import seed

            seed()
            print("Demo accounts and events prepared.")
    elif args.command == "seed":
        from app.db.seed import seed

        seed()
        print("Demo accounts and events prepared.")
    else:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
            current = set(MigrationContext.configure(connection).get_current_heads())
            expected = set(ScriptDirectory.from_config(config).get_heads())
        if current != expected:
            raise SystemExit("Database migrations are pending. Run the migrate command first.")
        print("Database connection and migration revision: OK.")


if __name__ == "__main__":
    main()
