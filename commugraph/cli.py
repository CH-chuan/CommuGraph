import typer
from rich.console import Console

app = typer.Typer(help="CommuGraph CLI")
console = Console()

@app.command()
def info():
    """
    Show project information.
    """
    console.print("[bold green]CommuGraph[/bold green]: Deep Analytics on Multi-Agent Chat Logs")
    console.print("Version: 0.1.0")

@app.command()
def build(log_file: str, output: str = "graph.html"):
    """
    Build a visualization from a log file.
    """
    typer.echo(f"Building graph from {log_file} -> {output}")
    # TODO: Connect to parser and builder
    pass

if __name__ == "__main__":
    app()

