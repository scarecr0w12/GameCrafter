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
            'result': {'protocolVersion': 1, 'tools': ['model-fixture/complete']},
        })
    elif method == 'plugin/tool/call' and request.get('params', {}).get('toolId') == 'model-fixture/complete':
        host_request_id = 'model-complete'
        send({
            'jsonrpc': '2.0',
            'id': host_request_id,
            'method': 'host/model/complete',
            'params': {'request': request.get('params', {}).get('input', {}).get('request', {})},
        })
        host_response_line = sys.stdin.readline()
        if not host_response_line:
            break
        host_response = json.loads(host_response_line)
        if 'error' in host_response:
            send({'jsonrpc': '2.0', 'id': request['id'], 'error': host_response['error']})
        else:
            result = host_response.get('result', {})
            send({
                'jsonrpc': '2.0',
                'id': request['id'],
                'result': {
                    'output': {
                        'content': result.get('content', ''),
                        'modelId': result.get('modelId', ''),
                    },
                },
            })
    elif method == 'plugin/shutdown':
        send({'jsonrpc': '2.0', 'id': request['id'], 'result': {}})
        break
    elif 'id' in request:
        send({'jsonrpc': '2.0', 'id': request['id'], 'error': {'code': -32601, 'message': 'Method not found'}})
