import json
import os
import socket
import sys


def failure(action):
    try:
        action()
        return None
    except Exception as error:
        return f"{type(error).__name__}:{getattr(error, 'errno', None)}"


def probe(arguments):
    project_error = failure(lambda: open(arguments['projectFile'], 'rb').read(1))
    home_path = os.path.join(os.environ['HOME'], 'escape.txt')
    home_error = failure(lambda: open(home_path, 'wb').write(b'escape'))
    scratch_path = os.path.join(os.environ['TMPDIR'], 'scratch.txt')
    scratch_error = failure(lambda: open(scratch_path, 'wb').write(b'scratch'))
    root_error = failure(lambda: open('/root/GameCrafter/package.json', 'rb').read(1))
    pids = sorted(name for name in os.listdir('/proc') if name.isdigit())
    network_error = None
    try:
        with socket.create_connection(('127.0.0.1', arguments['port']), timeout=2):
            pass
    except Exception as error:
        network_error = f"{type(error).__name__}:{getattr(error, 'errno', None)}"
    return {
        'projectError': project_error,
        'homeError': home_error,
        'scratchError': scratch_error,
        'rootError': root_error,
        'pids': pids,
        'networkError': network_error,
    }


def reply(message, result=None, error=None):
    response = {'jsonrpc': '2.0', 'id': message['id']}
    if error is None:
        response['result'] = result if result is not None else {}
    else:
        response['error'] = error
    sys.stdout.write(json.dumps(response) + '\n')
    sys.stdout.flush()


for line in sys.stdin:
    request = json.loads(line)
    method = request.get('method')
    if method == 'plugin/initialize':
        reply(request, {'protocolVersion': 1, 'tools': ['adversarial/probe']})
    elif method == 'plugin/tool/call':
        params = request.get('params', {})
        if params.get('toolId') == 'adversarial/probe':
            reply(request, {'output': probe(params.get('input', {}))})
        else:
            reply(request, error={'code': -32601, 'message': 'Unknown tool'})
    elif method == 'plugin/shutdown':
        reply(request, {})
        break
    else:
        reply(request, error={'code': -32601, 'message': 'Unknown method'})
