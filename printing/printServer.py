from flask import Flask, request, abort
import subprocess, tempfile, os

app = Flask(__name__)
AUTH_TOKEN = os.environ.get("PRINT_SERVER_TOKEN")
if not AUTH_TOKEN:
    raise RuntimeError("PRINT_SERVER_TOKEN is required")

@app.route("/print", methods=["POST"])
def print_file():
    if request.headers.get("Authorization") != f"Bearer {AUTH_TOKEN}":
        abort(401)

    # сохраняем PDF во временный файл
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as f:
        f.write(request.data)
        fname = f.name

    # печатаем через CUPS
    # subprocess.run(["lp", fname])
    subprocess.run(["lp", "-o", "sides=two-sided-long-edge", fname])
    os.remove(fname)

    return {"status": "printed"}

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8443)
