import yaml

with open('docker-compose.yml', 'r') as f:
    data = yaml.safe_load(f)

for service, config in data.get('services', {}).items():
    if 'environment' in config:
        env = config['environment']
        if isinstance(env, dict):
            env['REDIS_PASSWORD'] = '${REDIS_PASSWORD:-rootpassword}'
        elif isinstance(env, list):
            if not any(e.startswith('REDIS_PASSWORD=') for e in env):
                env.append('REDIS_PASSWORD=${REDIS_PASSWORD:-rootpassword}')

with open('docker-compose.yml', 'w') as f:
    yaml.dump(data, f, default_flow_style=False, sort_keys=False)
