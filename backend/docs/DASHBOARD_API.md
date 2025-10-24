# Dashboard API Documentation

## Overview

The Dashboard API provides comprehensive statistics and analytics for email campaigns. It includes endpoints for real-time statistics, recent activity, and performance trends.

## Base URL

```
http://localhost:3001/api/dashboard
```

## Endpoints

### 1. Dashboard Statistics

**GET** `/api/dashboard/stats`

Returns comprehensive dashboard statistics for email campaigns.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | string | No | Start date for filtering (ISO format) |
| `endDate` | string | No | End date for filtering (ISO format) |
| `sequenceId` | string | No | Filter by specific sequence ID |

#### Response

```json
{
  "totalEmailsSent": 7,
  "openRate": {
    "percentage": 42.86,
    "count": 3
  },
  "replyRate": {
    "percentage": 71.43,
    "count": 5
  },
  "bounceRate": {
    "percentage": 0,
    "count": 0
  },
  "dailyActivity": [0, 0, 0, 1, 14, 0, 0],
  "weeklyPerformance": [0, 0, 0, 15],
  "additionalMetrics": {
    "totalSequences": 7,
    "totalContacts": 4,
    "activeEnrollments": 3,
    "totalDelivered": 0,
    "totalClicked": 0,
    "totalUnsubscribed": 0,
    "totalFailed": 0
  },
  "eventBreakdown": {
    "sent": 7,
    "opened": 3,
    "replied": 5
  },
  "dateRange": {
    "startDate": "All time",
    "endDate": "All time",
    "sequenceId": "All sequences"
  }
}
```

#### Response Fields

- **totalEmailsSent**: Total number of emails sent
- **openRate**: Email open rate with percentage and count
- **replyRate**: Email reply rate with percentage and count
- **bounceRate**: Email bounce rate with percentage and count
- **dailyActivity**: Array of 7 numbers representing activity for each day of the week (Sunday=0, Saturday=6)
- **weeklyPerformance**: Array of 4 numbers representing activity for each week of the month
- **additionalMetrics**: Additional campaign metrics
- **eventBreakdown**: Raw event counts by type
- **dateRange**: Applied date and sequence filters

#### Example Usage

```bash
# Get all-time statistics
curl -X GET "http://localhost:3001/api/dashboard/stats"

# Get statistics for a specific date range
curl -X GET "http://localhost:3001/api/dashboard/stats?startDate=2024-01-01&endDate=2024-01-31"

# Get statistics for a specific sequence
curl -X GET "http://localhost:3001/api/dashboard/stats?sequenceId=clxxx123"
```

### 2. Recent Activity

**GET** `/api/dashboard/recent-activity`

Returns recent email activity for dashboard feed.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | number | No | Number of recent activities to return (default: 10) |

#### Response

```json
{
  "recentActivity": [
    {
      "id": "1",
      "type": "SENT",
      "timestamp": "2024-10-23T10:53:12.000Z",
      "contact": {
        "email": "test1@example.com",
        "name": "Test Contact 1"
      },
      "sequence": "Welcome Sequence"
    },
    {
      "id": "2",
      "type": "OPENED",
      "timestamp": "2024-10-23T09:53:12.000Z",
      "contact": {
        "email": "test2@example.com",
        "name": "Test Contact 2"
      },
      "sequence": "Follow-up Sequence"
    }
  ],
  "count": 2
}
```

#### Event Types

- `SENT`: Email was sent
- `DELIVERED`: Email was delivered
- `OPENED`: Email was opened
- `CLICKED`: Link in email was clicked
- `REPLIED`: Contact replied to email
- `BOUNCED`: Email bounced
- `UNSUBSCRIBED`: Contact unsubscribed
- `FAILED`: Email failed to send

#### Example Usage

```bash
# Get last 10 activities
curl -X GET "http://localhost:3001/api/dashboard/recent-activity"

# Get last 5 activities
curl -X GET "http://localhost:3001/api/dashboard/recent-activity?limit=5"
```

### 3. Performance Trends

**GET** `/api/dashboard/performance-trends`

Returns performance trends over time.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `days` | number | No | Number of days to include (default: 30) |
| `sequenceId` | string | No | Filter by specific sequence ID |

#### Response

```json
{
  "trends": [
    {
      "date": "2024-10-23",
      "sent": 5,
      "opened": 2,
      "replied": 1,
      "bounced": 0,
      "clicked": 1,
      "delivered": 5,
      "openRate": "40.00",
      "replyRate": "20.00",
      "bounceRate": "0.00"
    }
  ],
  "period": "30 days",
  "totalDays": 1
}
```

#### Example Usage

```bash
# Get 30-day trends
curl -X GET "http://localhost:3001/api/dashboard/performance-trends"

# Get 7-day trends
curl -X GET "http://localhost:3001/api/dashboard/performance-trends?days=7"

# Get trends for specific sequence
curl -X GET "http://localhost:3001/api/dashboard/performance-trends?sequenceId=clxxx123"
```

## Error Responses

All endpoints return standard HTTP status codes and error responses:

```json
{
  "error": "Error message",
  "details": "Detailed error information (development only)"
}
```

### Common Status Codes

- `200 OK`: Request successful
- `400 Bad Request`: Invalid request parameters
- `500 Internal Server Error`: Server error

## Frontend Integration

### React/JavaScript Example

```javascript
// Fetch dashboard statistics
const fetchDashboardStats = async () => {
  try {
    const response = await fetch('/api/dashboard/stats');
    const data = await response.json();
    
    console.log('Total emails sent:', data.totalEmailsSent);
    console.log('Open rate:', data.openRate.percentage + '%');
    console.log('Daily activity:', data.dailyActivity);
    
    return data;
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
  }
};

// Fetch recent activity
const fetchRecentActivity = async (limit = 10) => {
  try {
    const response = await fetch(`/api/dashboard/recent-activity?limit=${limit}`);
    const data = await response.json();
    
    console.log('Recent activities:', data.recentActivity);
    
    return data;
  } catch (error) {
    console.error('Error fetching recent activity:', error);
  }
};

// Fetch performance trends
const fetchPerformanceTrends = async (days = 30) => {
  try {
    const response = await fetch(`/api/dashboard/performance-trends?days=${days}`);
    const data = await response.json();
    
    console.log('Performance trends:', data.trends);
    
    return data;
  } catch (error) {
    console.error('Error fetching performance trends:', error);
  }
};
```

### Chart.js Integration Example

```javascript
// Create daily activity chart
const createDailyActivityChart = (dailyActivity) => {
  const ctx = document.getElementById('dailyActivityChart').getContext('2d');
  
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      datasets: [{
        label: 'Email Activity',
        data: dailyActivity,
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
};

// Create performance trends chart
const createTrendsChart = (trends) => {
  const ctx = document.getElementById('trendsChart').getContext('2d');
  
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: trends.map(t => t.date),
      datasets: [
        {
          label: 'Open Rate %',
          data: trends.map(t => parseFloat(t.openRate)),
          borderColor: 'rgba(75, 192, 192, 1)',
          tension: 0.1
        },
        {
          label: 'Reply Rate %',
          data: trends.map(t => parseFloat(t.replyRate)),
          borderColor: 'rgba(255, 99, 132, 1)',
          tension: 0.1
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          max: 100
        }
      }
    }
  });
};
```

## Database Schema Reference

The dashboard API uses the following database tables:

- **Event**: Stores all email events (SENT, OPENED, REPLIED, etc.)
- **Sequence**: Email sequences/campaigns
- **Contact**: Contact information
- **Enrollment**: Contact enrollments in sequences

## Rate Limiting

All dashboard endpoints are subject to the global rate limit:
- **100 requests per 15 minutes** per IP address

## Security

- All endpoints use CORS protection
- Helmet security headers applied
- Rate limiting enabled
- No authentication required (add as needed)

## Performance Notes

- Dashboard statistics are calculated in real-time
- Large date ranges may impact performance
- Consider implementing caching for production use
- Database indexes recommended on Event.timestamp and Event.type fields

## Troubleshooting

### Common Issues

1. **Empty Statistics**: Ensure events exist in the database
2. **Slow Response**: Check database indexes and query performance
3. **CORS Errors**: Verify frontend origin is in CORS whitelist
4. **Rate Limiting**: Reduce request frequency if hitting limits

### Debug Mode

Set `NODE_ENV=development` to enable detailed error messages in API responses.
