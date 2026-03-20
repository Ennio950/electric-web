import sqlite3
import sys


def main() -> int:
    if len(sys.argv) < 3:
        print("Uso: python delete-workflows.py <dbPath> <workflowId...>", file=sys.stderr)
        return 1

    db_path = sys.argv[1]
    workflow_ids = [value for value in sys.argv[2:] if value]
    if not workflow_ids:
        print("Debes indicar al menos un workflowId.", file=sys.stderr)
        return 1

    placeholders = ",".join("?" for _ in workflow_ids)
    connection = sqlite3.connect(db_path)

    try:
      with connection:
        connection.execute(
            f"DELETE FROM shared_workflow WHERE workflowId IN ({placeholders})",
            workflow_ids,
        )
        connection.execute(
            f"DELETE FROM workflow_history WHERE workflowId IN ({placeholders})",
            workflow_ids,
        )
        connection.execute(
            f"DELETE FROM workflow_entity WHERE id IN ({placeholders})",
            workflow_ids,
        )
    finally:
        connection.close()

    print(f"Deleted workflows: {', '.join(workflow_ids)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
