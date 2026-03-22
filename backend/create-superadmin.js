const bcrypt = require('bcryptjs');
const prisma = require('./src/db/prismaClient');

const createSuperAdmin = async () => {
  try {
    console.log('🔐 Creating superadmin account...');

    // Use environment variables or defaults
    const email = process.env.SUPERADMIN_EMAIL || 'superadmin@emailsequence.com';
    const password = process.env.SUPERADMIN_PASSWORD || 'speradmin123';
    const firstName = process.env.SUPERADMIN_FIRST_NAME || 'Super';
    const lastName = process.env.SUPERADMIN_LAST_NAME || 'Admin';

    console.log(`📧 Email: ${email}`);
    console.log(`👤 Name: ${firstName} ${lastName}`);

    // Check if superadmin already exists
    const existingSuperAdmin = await prisma.user.findUnique({
      where: { email }
    });

    if (existingSuperAdmin) {
      console.log(`✅ Superadmin already exists with email: ${email}`);
      console.log(`⚠️  Skipping creation to avoid duplicate.`);
      process.exit(0);
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create superadmin
    const superadmin = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: 'SUPERADMIN',
        isActive: true
      }
    });

    console.log('✅ Superadmin account created successfully!');
    console.log('\n📋 Account Details:');
    console.log(`   Email: ${superadmin.email}`);
    console.log(`   Name: ${superadmin.firstName} ${superadmin.lastName}`);
    console.log(`   Role: ${superadmin.role}`);
    console.log(`   Active: ${superadmin.isActive}`);
    console.log(`   ID: ${superadmin.id}`);
    console.log('\n🔐 Credentials:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log('\n⚠️  Please keep these credentials secure!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating superadmin:', error);
    process.exit(1);
  }
};

createSuperAdmin();
