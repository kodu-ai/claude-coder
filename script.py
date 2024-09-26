import os
import fnmatch
from pathlib import Path

def parse_gitignore(gitignore_path):
    ignore_patterns = []
    if gitignore_path.exists():
        with open(gitignore_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    ignore_patterns.append(line)
    return ignore_patterns

def should_ignore(path, ignore_patterns, root):
    rel_path = os.path.relpath(path, root)
    for pattern in ignore_patterns:
        if pattern.endswith('/'):
            if fnmatch.fnmatch(f"{rel_path}/", pattern) or fnmatch.fnmatch(f"{rel_path}/**", pattern):
                return True
        elif fnmatch.fnmatch(rel_path, pattern):
            return True
    return False

def is_typescript_file(file):
    return file.endswith(('.ts', '.tsx'))

def aggregate_typescript_files(root_dir, output_file):
    root_dir = Path(root_dir).resolve()
    gitignore_path = root_dir / '.gitignore'
    ignore_patterns = parse_gitignore(gitignore_path)
    
    with open(output_file, 'w', encoding='utf-8') as out_file:
        for root, dirs, files in os.walk(root_dir):
            # Remove ignored directories
            dirs[:] = [d for d in dirs if not should_ignore(os.path.join(root, d), ignore_patterns, root_dir)]
            
            for file in files:
                file_path = os.path.join(root, file)
                if is_typescript_file(file) and not should_ignore(file_path, ignore_patterns, root_dir):
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            content = f.read()
                            relative_path = os.path.relpath(file_path, root_dir)
                            out_file.write(f'<file="{relative_path}">\n')
                            out_file.write(content)
                            out_file.write('\n</file>\n\n')
                        print(f"Processed: {relative_path}")
                    except Exception as e:
                        print(f"Error reading file {file_path}: {e}")

if __name__ == "__main__":
    root_directory = "."  # Current directory
    output_file = "aggregated_typescript_content.txt"
    aggregate_typescript_files(root_directory, output_file)
    print(f"Aggregation complete. Output written to {output_file}")