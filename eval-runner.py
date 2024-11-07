import requests
import json
import os
import sys
import subprocess
import select
import time
import signal

# URL to fetch the dataset
DATASET_URL = "https://datasets-server.huggingface.co/rows?dataset=princeton-nlp%2FSWE-bench_Lite&config=default&split=test&offset=0&length=100"

def main():
    dataset = fetch_dataset()
    problem_id = sys.argv[1] if len(sys.argv) > 1 else os.getenv("PROBLEM_ID", "0")

    make_dirs_if_not_exist()

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

    instance_id = row["instance_id"]
    log_file_path = f"eval_logs/{instance_id}.log"
    diff_file_path = f"eval_output/{instance_id}.txt"

    clone_repo_at_commit(repo_url, abs_repo_dir, base_commit)
    write_problem_statement(row, repo_dir)
    is_successful = run_kodu_cli(repo_dir, log_file_path)

    if is_successful:
        print("\033[92mExecution completed successfully!\033[0m")

        write_diff(diff_file_path, abs_repo_dir)
    else:
        print("\033[31mExecution failed!\033[0m")

    sys.exit()


def make_dirs_if_not_exist():
    if not os.path.exists("eval_output"):
        os.makedirs("eval_output")

    if not os.path.exists("eval_data"):
        os.makedirs("eval_data")
    if not os.path.exists("eval_data/00_problem_statements"):
        os.makedirs("eval_data/00_problem_statements")

    if not os.path.exists("eval_logs"):
        os.makedirs("eval_logs")


def fetch_dataset():
    """Fetch the dataset using requests."""
    response = requests.get(DATASET_URL)
    if response.status_code != 200:
        print("Failed to fetch dataset:", response.text)
        sys.exit(1)
    return response.json()


def clone_repo_at_commit(repo_url, repo_dir, commit_hash):
    """Clone the repository at the specified commit."""

    # # Stash any changes in the existing repo if it exists
    # if os.path.exists(repo_dir):
    #     subprocess.run(["git", "stash",], cwd=repo_dir, check=True)
    #     subprocess.run(["git", "clean", "-f"], cwd=repo_dir, check=True)
    #     return

    if os.path.exists(repo_dir):
        subprocess.run(["rm", "-rf", repo_dir], check=True)

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


def run_kodu_cli(directory, log_file_path):
    """Run kodu-cli with the problem statement and write logs to a file."""
    is_successful = 0
    timeout = 5 * 50  # Timeout in seconds (5 minutes)
    last_output_time = time.time()

    try:
        process = subprocess.Popen(
            ["bash", "-c", f"cd ./extension && npm run exec-test {directory}"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        with open(log_file_path, 'w') as log_file:
            while True:
                # Calculate the remaining time
                elapsed_time = time.time() - last_output_time
                remaining_time = max(0, timeout - elapsed_time)
                if remaining_time == 0:
                    # Timeout occurred
                    print("Timeout occurred: No output received for 5 minutes.")
                    log_file.write("Timeout occurred: No output received for 5 minutes.\n")
                    force_kill_process(process)
                    return is_successful

                # Wait for output with timeout
                ready = select.select([process.stdout], [], [], remaining_time)
                if ready[0]:
                    line = process.stdout.readline()
                    if line == '':
                        # EOF reached
                        break
                    else:
                        last_output_time = time.time()
                        print(line, end='')
                        log_file.write(line)  # Reset timer

                        if "</ask_followup_question>" in line:
                            force_kill_process(process)
                            return 0

                        if not is_successful and "</attempt_completion>" in line:
                            force_kill_process(process)
                            return 1
                else:
                    # No output received within remaining_time
                    print("Timeout occurred: No output received for 2 minutes.")
                    log_file.write("Timeout occurred: No output received for 2 minutes.\n")
                    force_kill_process(process)
                    return is_successful

            # Wait for the process to complete
            process.wait()

            # Capture any remaining stderr output
            stderr_output = process.stderr.read()
            if stderr_output:
                print(stderr_output)
                log_file.write(stderr_output)

    except Exception as e:
        error_message = f"Error running kodu-cli: {e}"
        print(error_message)
        with open(log_file_path, 'a') as log_file:
            log_file.write(error_message + '\n')

    return is_successful


def force_kill_process(process):
    """Forcefully kill a process and all of its child processes."""
    try:
        print(process.pid)

        process.stdout.close()
        process.stderr.close()

        process.kill()
        subprocess.run(["pkill", "-f", ".vscode-test"], check=True, text=True, capture_output=True)


    except Exception as e:
        print(f"Error forcefully killing process: {e}")


def write_diff(diff_file_path, abs_repo_dir):
    # Get the git diff and save to output file
    diff_output = subprocess.check_output(["git", "diff"], cwd=abs_repo_dir, text=True)

    # Write diff to file named after instance_id
    with open(diff_file_path, "w") as f:
        f.write(diff_output)

    print(f"Diff output written to {diff_file_path}")

if __name__ == "__main__":
    main()