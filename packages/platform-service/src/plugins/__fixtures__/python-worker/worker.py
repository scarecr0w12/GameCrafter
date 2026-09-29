import json
import sys


def send(message):
    sys.stdout.write(json.dumps(message) + '\n')
    sys.stdout.flush()


for line in sys.stdin:
    request = json.loads(line)
    method = request.get('method')
    if method == 'plugin/initialize':
        send({
            'jsonrpc': '2.0',
            'id': request['id'],
            'result': {
                'protocolVersion': 1,
                'tools': ['python-fixture/echo', 'python-fixture/execute_code'],
            },
        })
    elif method == 'plugin/tool/call' and request.get('params', {}).get('toolId') in {
        'python-fixture/echo',
        'python-fixture/execute_code',
    }:
        value = request.get('params', {}).get('input', {})
        send({
            'jsonrpc': '2.0',
            'id': request['id'],
            'result': {'output': {'echo': value}},
        })
    elif method == 'plugin/shutdown':
        send({'jsonrpc': '2.0', 'id': request['id'], 'result': {}})
        break
    elif 'id' in request:
        send({'jsonrpc': '2.0', 'id': request['id'], 'error': {'code': -32601, 'message': 'Method not found'}})
