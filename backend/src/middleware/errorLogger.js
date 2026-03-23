/**
 * Database Error Logger Middleware
 * Catches and logs all Prisma errors with detailed stack traces
 */

const errorLogger = (err, req, res, next) => {
  if (err) {
    console.error('\n' + '='.repeat(80));
    console.error('❌ ERROR CAUGHT');
    console.error('='.repeat(80));
    console.error('URL:', req.method, req.path);
    console.error('Message:', err.message);
    console.error('Code:', err.code);
    console.error('Type:', err.constructor.name);
    console.error('Stack:', err.stack);
    console.error('='.repeat(80) + '\n');
    
    // If it's a Prisma error, send detailed response in dev
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'production') {
      return res.status(500).json({
        error: 'Database error',
        message: err.message,
        code: err.code,
        type: err.constructor.name
      });
    }
  }
  
  next();
};

module.exports = errorLogger;
