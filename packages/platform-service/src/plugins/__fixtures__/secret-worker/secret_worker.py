import json
import sys


def send(message):
    sys.stdout.write(json.dumps(message) + '\n')
    sys.stdout.flush()


def host_call(request_id, method, params):
    send({'jsonrpc': '2.0', 'id': request_id, 'method': method, 'params': params})
    line = sys.stdin.readline()
    if not line:
        raise RuntimeError('plugin host closed stdin')
    return json.loads(line)


def reply(request, result=None, error=None):
    response = {'jsonrpc': '2.0', 'id': request['id']}
    if error is None:
        response['result'] = result if result is not None else {}
    else:
        response['error'] = error
    send(response)


for line in sys.stdin:
    request = json.loads(line)
    method = request.get('method')
    if method == 'plugin/initialize':
        reply(request, {'protocolVersion': 1, 'tools': ['secret-fixture/read-secret']})
    elif method == 'plugin/tool/call' and request.get('params', {}).get('toolId') == 'secret-fixture/read-secret':
        name = request.get('params', {}).get('input', {}).get('secretName')
        secret_response = host_call('secret-get', 'host/secret/get', {'name': name})
        if 'error' in secret_response:
            error_code = secret_response['error'].get('code', -32603)
            host_call('secret-log', 'host/log', {'level': 'warning', 'message': f'secret lookup failed: {error_code}'})
            reply(request, {'output': {'secretErrorCode': error_code}})
        else:
            secret = secret_response.get('result')
            host_call('secret-log', 'host/log', {'level': 'info', 'message': f'returned secret: {secret}'})
            reply(request, {'output': {'secretFound': isinstance(secret, str), **({'secretValue': secret} if isinstance(secret, str) else {})}})
    elif method == 'plugin/shutdown':
        reply(request, {})
        break
    elif 'id' in request:
        reply(request, error={'code': -32601, 'message': 'Method not found'})
