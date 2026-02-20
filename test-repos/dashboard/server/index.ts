import express from 'express'
import cors from 'cors'

const app = express()
const PORT = 3001

app.use(cors())
app.use(express.json())

app.get('/api/dashboard/stats', (_req, res) => {
  res.json({
    summary: {
      totalSales: 124500,
      totalOrders: 1847,
      averageOrder: 67.4,
      growthRate: 12.5,
    },
    monthlySales: [
      { month: 'Jan', sales: 8200 },
      { month: 'Feb', sales: 9100 },
      { month: 'Mar', sales: 10400 },
      { month: 'Apr', sales: 9800 },
      { month: 'May', sales: 11200 },
      { month: 'Jun', sales: 12100 },
      { month: 'Jul', sales: 10900 },
      { month: 'Aug', sales: 11800 },
      { month: 'Sep', sales: 13200 },
      { month: 'Oct', sales: 12400 },
      { month: 'Nov', sales: 14100 },
      { month: 'Dec', sales: 11300 },
    ],
    categories: [
      { name: 'Electronics', value: 35 },
      { name: 'Clothing', value: 25 },
      { name: 'Books', value: 15 },
      { name: 'Home', value: 15 },
      { name: 'Other', value: 10 },
    ],
    recentOrders: [
      { id: 1001, customer: 'Alice Johnson', amount: 89.99, status: 'completed', date: '2026-02-19' },
      { id: 1002, customer: 'Bob Smith', amount: 134.50, status: 'pending', date: '2026-02-19' },
      { id: 1003, customer: 'Carol Davis', amount: 45.00, status: 'completed', date: '2026-02-18' },
      { id: 1004, customer: 'David Wilson', amount: 220.00, status: 'shipped', date: '2026-02-18' },
      { id: 1005, customer: 'Eve Brown', amount: 67.25, status: 'completed', date: '2026-02-17' },
      { id: 1006, customer: 'Frank Miller', amount: 155.75, status: 'pending', date: '2026-02-17' },
      { id: 1007, customer: 'Grace Lee', amount: 92.00, status: 'shipped', date: '2026-02-16' },
      { id: 1008, customer: 'Henry Chen', amount: 78.50, status: 'completed', date: '2026-02-16' },
    ],
  })
})

app.listen(PORT, () => {
  console.log(`Dashboard server running on http://localhost:${PORT}`)
})
