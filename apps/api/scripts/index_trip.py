import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv()

from rag.indexer import index_trip


def main() -> None:
    parser = argparse.ArgumentParser(description="Index a trip into Qdrant for RAG")
    parser.add_argument("--trip-id", required=True, help="UUID of the trip to index")
    args = parser.parse_args()

    print(f"Indexing trip {args.trip_id}...")
    count = index_trip(args.trip_id)
    print(f"Done. Indexed {count} chunks.")


if __name__ == "__main__":
    main()
