'use client'

import { DashboardLayout } from '@/components/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { TrendingUp, Users, DollarSign, BarChart3 } from 'lucide-react'

export default function Dashboard() {
  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">$45,231.89</div>
              <p className="text-xs text-green-400">
                <TrendingUp className="inline h-3 w-3 mr-1" />
                +20.1% from last month
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Active Users</CardTitle>
              <Users className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">2,350</div>
              <p className="text-xs text-blue-400">
                <TrendingUp className="inline h-3 w-3 mr-1" />
                +180.1% from last month
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Conversion Rate</CardTitle>
              <BarChart3 className="h-4 w-4 text-yellow-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">23.1%</div>
              <p className="text-xs text-yellow-400">
                +2.5% from last month
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Tasks Complete</CardTitle>
              <BarChart3 className="h-4 w-4 text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">89.2%</div>
              <p className="text-xs text-purple-400">
                +5.2% from yesterday
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Recent Activity</CardTitle>
              <CardDescription className="text-gray-400">Your latest actions and updates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm text-white">Completed task: Update dashboard metrics</p>
                    <p className="text-xs text-gray-400">2 minutes ago</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm text-white">New user registered: john@example.com</p>
                    <p className="text-xs text-gray-400">5 minutes ago</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm text-white">System backup completed successfully</p>
                    <p className="text-xs text-gray-400">1 hour ago</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Quick Actions</CardTitle>
              <CardDescription className="text-gray-400">Common tasks and shortcuts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <Button className="h-20 flex flex-col space-y-2 bg-blue-600 hover:bg-blue-700">
                  <Users className="h-5 w-5" />
                  <span className="text-xs">Add User</span>
                </Button>
                <Button className="h-20 flex flex-col space-y-2 bg-green-600 hover:bg-green-700">
                  <BarChart3 className="h-5 w-5" />
                  <span className="text-xs">View Reports</span>
                </Button>
                <Button className="h-20 flex flex-col space-y-2 bg-purple-600 hover:bg-purple-700">
                  <DollarSign className="h-5 w-5" />
                  <span className="text-xs">Billing</span>
                </Button>
                <Button className="h-20 flex flex-col space-y-2 bg-yellow-600 hover:bg-yellow-700">
                  <TrendingUp className="h-5 w-5" />
                  <span className="text-xs">Analytics</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Progress Overview */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Project Progress</CardTitle>
            <CardDescription className="text-gray-400">Current status of ongoing projects</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-white">Website Redesign</span>
                  <Badge className="bg-green-600">On Track</Badge>
                </div>
                <Progress value={75} className="bg-gray-800" />
                <p className="text-xs text-gray-400">75% complete - Due in 5 days</p>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-white">Mobile App Development</span>
                  <Badge className="bg-yellow-600">In Progress</Badge>
                </div>
                <Progress value={45} className="bg-gray-800" />
                <p className="text-xs text-gray-400">45% complete - Due in 12 days</p>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-white">API Integration</span>
                  <Badge className="bg-red-600">Behind</Badge>
                </div>
                <Progress value={20} className="bg-gray-800" />
                <p className="text-xs text-gray-400">20% complete - Due in 3 days</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}