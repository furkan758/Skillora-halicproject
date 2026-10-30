from io import BytesIO
import json
from unittest.mock import patch

from scripts import run


def test_existing_skillora_process_is_reused(capsys):
    with patch.object(run, "get_settings"), patch.object(run, "is_skillora_running", return_value=True), patch.object(run.uvicorn, "run") as start:
        assert run.main() == 0
        start.assert_not_called()
    assert "already running" in capsys.readouterr().out


def test_unavailable_port_has_a_readable_error(capsys):
    with patch.object(run, "get_settings"), patch.object(run, "is_skillora_running", return_value=False), patch.object(run.socket, "socket") as socket_factory, patch.object(run.uvicorn, "run") as start:
        socket_factory.return_value.__enter__.return_value.bind.side_effect = OSError(10013, "Permission denied")
        assert run.main() == 1
        start.assert_not_called()
    assert "API_PORT" in capsys.readouterr().out


def test_health_probe_only_accepts_skillora():
    response = BytesIO(json.dumps({"service": "another-app"}).encode())
    with patch.object(run, "urlopen", return_value=response):
        assert not run.is_skillora_running("127.0.0.1", 8000)
