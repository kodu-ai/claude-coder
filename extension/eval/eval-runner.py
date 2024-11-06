import requests
import subprocess
import json
import os
import sys
# URL to fetch the dataset
DATASET_URL = "https://datasets-server.huggingface.co/rows?dataset=princeton-nlp%2FSWE-bench_Lite&config=default&split=dev&offset=0&length=100"

def fetch_dataset():
    """Fetch the dataset using requests."""
    response = requests.get(DATASET_URL)
    if response.status_code != 200:
        print("Failed to fetch dataset:", response.text)
        sys.exit(1)
    return response.json()

def clone_repo_at_commit(repo_url, repo_dir, commit_hash):
    """Clone the repository at the specified commit."""
    try:
        if not os.path.exists(repo_dir):
            print(f"Cloning repository {repo_url} into {repo_dir}")
            print(os.getcwd())
            print(os.listdir(os.getcwd()))
            subprocess.run(["git", "clone", repo_url, repo_dir], check=True)
            print(os.getcwd())
            print(os.listdir(os.getcwd()))
            subprocess.run(["git", "checkout", commit_hash], cwd=repo_dir, check=True)
    except Exception as e:
        print(f"Error cloning repository: {e}")
        sys.exit(1)

def run_kodu_cli(directory):
    """Run kodu-cli with the problem statement."""
    subprocess.run(["bash", "-c", "cd ../extension && npm run exec-test " + directory], check=True)


def main():
    print("Running eval-runner.py")

    # Fetch the dataset
    dataset = fetch_dataset()

    # Get the PROBLEM_ID from the environment variable
    problem_id = sys.argv[1] if len(sys.argv) > 1 else os.getenv("PROBLEM_ID", "0")

    print(f"Problem ID: {problem_id}")

    try:
        problem_id = int(problem_id)
    except ValueError:
        print("PROBLEM_ID must be an integer.")
        sys.exit(1)

    # Select the problem based on the PROBLEM_ID
    if problem_id >= len(dataset["rows"]):
        print(f"PROBLEM_ID {problem_id} is out of range.")
        sys.exit(1)

    row = dataset["rows"][problem_id]["row"]

    repo_url = f"https://github.com/{row['repo']}"
    repo_dir = str(problem_id) + "_" + row["repo"].replace("/", "_")

    # Delete repo directory if it exists

    base_commit = row["base_commit"]
    test_patch = row["test_patch"]
    problem_statement = row["problem_statement"]
    # Write problem statement to a file
    problem_file = "00_problem_statements/" + repo_dir + ".txt"

    if not os.path.exists(repo_dir):
        clone_repo_at_commit(repo_url, repo_dir, base_commit)

    if not os.path.exists(problem_file):
        with open(problem_file, "w") as f:
            f.write(problem_statement)
    print(f"Problem statement written to {problem_file}")


    run_kodu_cli(repo_dir)

if __name__ == "__main__":
    main()