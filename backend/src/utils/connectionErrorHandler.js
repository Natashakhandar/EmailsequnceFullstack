/**
 * Connection Error Handler - Handles database connection errors gracefully
 * Provides user-friendly responses for connection limit issues
 */

const isConnectionError = (error) => {
  const errorMsg = (error.message || '').toLowerCase();
  return error.code === 'ER_TOO_MANY_CONNECTIONS' || 
         error.code === 'ER_CON_COUNT_ERROR' ||
         error.code === 'ECONNREFUSED' ||
         error.code === 'ENOTFOUND' ||
         errorMsg.includes('max_connections') ||
         errorMsg.includes('too many connections') ||
         errorMsg.includes("can't reach database") ||
         errorMsg.includes('connection refused') ||
         errorMsg.includes('getaddrinfo') ||
         errorMsg.includes('econnrefused');
};

const handleConnectionError = (error, res, context = 'database operation') => {
  // Make sure we haven't already sent a response
  if (res.headersSent) {
    console.warn(`⚠️ Headers already sent, cannot send error response for ${context}`);
    return;
  }

  const errorMsg = error && error.message ? String(error.message) : 'Unknown error';
  console.error(`❌ Connection Error in ${context}: ${errorMsg.substring(0, 200)}`);
  
  try {
    if (isConnectionError(error)) {
      console.log('📤 Sending 503 ServiceUnavailable');
      res.status(503).json({
        error: 'Database service temporarily unavailable',
        message: 'The database connection limit has been reached. Please try again in a few moments.',
        retry: true,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log('📤 Sending 500 Internal Server Error');
      res.status(500).json({
        error: 'Database error',
        message: `Failed to process ${context}. Please try again.`,
        timestamp: new Date().toISOString()
      });
    }
  } catch (err) {
    console.error('❌ Error sending error response:', err.message);
    // If JSON serialization fails, try text response
    if (!res.headersSent) {
      res.status(500).send('Internal server error');
    }
  }
};

const handleConnectionErrorHtml = (error, res, context = 'operation') => {
  console.error(`❌ Connection Error in ${context}:`, error.message);
  
  const isConnection = isConnectionError(error);
  const title = isConnection ? 'System Overloaded' : 'Error';
  const message = isConnection 
    ? 'The system is currently overloaded. Please try again in a few moments.'
    : `An error occurred while processing your ${context}. Please try again.`;
  
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(isConnection ? 503 : 500).send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto; background: linear-gradient(135deg, #f5f7fa 0%, #f0f2f5 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; }
        .container { background: white; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); padding: 48px; text-align: center; max-width: 500px; }
        h1 { color: ${isConnection ? '#f57c00' : '#d32f2f'}; font-size: 28px; margin-bottom: 12px; }
        p { color: #666; font-size: 15px; line-height: 1.6; }
        .button { display: inline-block; margin-top: 20px; padding: 10px 20px; background: #0b57d0; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
    </style>
</head>
<body>
    <div class="container">
        <h1>${isConnection ? '⏳ System Overloaded' : '⚠️ Error'}</h1>
        <p>${message}</p>
        <button class="button" onclick="setTimeout(() => location.reload(), 2000);">
          Retry in 2 seconds...
        </button>
    </div>
</body>
</html>
  `);
};

module.exports = {
  isConnectionError,
  handleConnectionError,
  handleConnectionErrorHtml
};
