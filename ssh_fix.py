import paramiko
import time

host = '89.117.27.1'
port = 65002
username = 'u825197931'
password = 'Boost@123'

print('🔗 Connecting to Hostinger server...')

try:
    # Create SSH client
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, port=port, username=username, password=password, timeout=10)
    
    print('✅ Connected!')
    
    # Kill existing node processes
    print('\n🛑 Stopping existing Node processes...')
    stdin, stdout, stderr = client.exec_command('cd public_html/EmailsequnceFullstack && killall -9 node 2>/dev/null; sleep 2; echo "Done"')
    print(stdout.read().decode())
    
    # Install dependencies
    print('\n📦 Installing dependencies...')
    stdin, stdout, stderr = client.exec_command('cd public_html/EmailsequnceFullstack/backend && npm install 2>&1 | tail -10')
    print(stdout.read().decode())
    
    # Generate Prisma client
    print('\n🔧 Generating Prisma client...')
    stdin, stdout, stderr = client.exec_command('cd public_html/EmailsequnceFullstack/backend && npx prisma generate')
    print(stdout.read().decode())
    err = stderr.read().decode()
    if err:
        print('Output:', err)
    
    # Start backend
    print('\n▶️  Starting backend server...')
    stdin, stdout, stderr = client.exec_command('cd public_html/EmailsequnceFullstack && npm start 2>&1 &')
    time.sleep(3)
    
    # Check status
    print('\n📊 Checking process status...')
    stdin, stdout, stderr = client.exec_command('pm2 status')
    print(stdout.read().decode())
    
    # Verify backend is responding
    time.sleep(2)
    stdin, stdout, stderr = client.exec_command('curl -s https://silver-tapir-929419.hostingersite.com:3001/api/health || echo "Backend checking..."')
    response = stdout.read().decode()
    print('\nBackend response:', response[:200])
    
    print('\n✅ Backend startup complete!')
    
    client.close()
    
except Exception as e:
    print(f'❌ Error: {e}')
