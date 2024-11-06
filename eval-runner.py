import requests
import subprocess
import json
import os
import sys
# URL to fetch the dataset
DATASET_URL = "https://datasets-server.huggingface.co/rows?dataset=princeton-nlp%2FSWE-bench_Lite&config=default&split=dev&offset=0&length=100"

def main():
    dataset = fetch_dataset()
    problem_id = sys.argv[1] if len(sys.argv) > 1 else os.getenv("PROBLEM_ID", "0")

    try:
        problem_id = int(problem_id)
    except ValueError:
        print("PROBLEM_ID must be an integer.")
        sys.exit(1)

    if problem_id >= len(dataset["rows"]):
        print(f"PROBLEM_ID {problem_id} is out of range.")
        sys.exit(1)

    row = dataset["rows"][problem_id]["row"]
    repo_url = f"https://github.com/{row['repo']}"
    repo_dir = str(problem_id) + "_" + row["repo"].replace("/", "_")
    abs_repo_dir = "eval_data/" + repo_dir
    base_commit = row["base_commit"]

    clone_repo_at_commit(repo_url, abs_repo_dir, base_commit)
    write_problem_statement(row, repo_dir)
    run_kodu_cli(repo_dir)


    done_file = os.path.join(abs_repo_dir, "done.txt")
    if os.path.exists(done_file):
        print("\033[92mExecution completed successfully!\033[0m")
        os.remove(done_file)

        write_diff(row["instance_id"], abs_repo_dir)
    else:
        print("\033[31mExecution failed - no done.txt file found!\033[0m")


def fetch_dataset():
    """Fetch the dataset using requests."""
    response = requests.get(DATASET_URL)
    if response.status_code != 200:
        print("Failed to fetch dataset:", response.text)
        sys.exit(1)
    return response.json()


def clone_repo_at_commit(repo_url, repo_dir, commit_hash):
    """Clone the repository at the specified commit."""

    # Stash any changes in the existing repo if it exists
    if os.path.exists(repo_dir):
        subprocess.run(["git", "stash",], cwd=repo_dir, check=True)
        subprocess.run(["git", "clean", "-f"], cwd=repo_dir, check=True)
        return

    try:
        if not os.path.exists(repo_dir):
            subprocess.run(["git", "clone", repo_url, repo_dir], check=True)
            subprocess.run(["git", "checkout", commit_hash], cwd=repo_dir, check=True)
    except Exception as e:
        print(f"Error cloning repository: {e}")
        sys.exit(1)


def write_problem_statement(row, repo_dir):
    problem_statement_file = "eval_data/00_problem_statements/" + repo_dir + ".json"

    if not os.path.exists(problem_statement_file):
        with open(problem_statement_file, "w") as f:
            json.dump(row, f, indent=4)
    print(f"Problem statement written to {problem_statement_file}")


def run_kodu_cli(directory):
    """Run kodu-cli with the problem statement."""
    subprocess.run(["bash", "-c", "cd ./extension && npm run exec-test " + directory], check=True)


def write_diff(instance_id, abs_repo_dir):
    # Get the git diff and save to output file
    diff_output = subprocess.check_output(["git", "diff"], cwd=abs_repo_dir, text=True)

    # Write diff to file named after instance_id
    output_file = f"eval_output/{instance_id}.txt"
    with open(output_file, "w") as f:
        f.write(diff_output)

    print(f"Diff output written to {output_file}")

if __name__ == "__main__":
    main()