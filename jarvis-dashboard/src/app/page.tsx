'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  Brain,
  Calendar,
  CheckCircle,
  Clock,
  DollarSign,
  Mail,
  Users,
  Target,
  Cloud,
  Sun,
  CloudRain,
  TrendingUp,
  TrendingDown,
  Activity,
  Settings,
  Plus,
  MessageSquare,
  ChevronRight,
  Zap,
  BarChart3,
  User
} from 'lucide-react';
import { Sidebar } from '@/components/sidebar';
import { ChatInterface } from '@/components/chat-interface';
import { cn } from '@/lib/utils';

interface KPICard {
  title: string;
  value: string;
  change: string;
  icon: React.ElementType;
  trend: 'up' | 'down';
}

interface Project {
  id: string;
  name: string;
  status: 'active' | 'planning' | 'review';
  progress: number;
  team: string[];
  dueDate: string;
}

interface Task {
  id: string;
  title: string;
  completed: boolean;
  priority: 'high' | 'medium' | 'low';
}

interface ScheduleItem {
  id: string;
  time: string;
  title: string;
  type: 'meeting' | 'task' | 'break';
}

interface AgentActivity {
  id: string;
  agent: string;
  action: string;
  timestamp: string;
  status: 'success' | 'pending' | 'error';
}

export default function Dashboard() {
  const [showChat, setShowChat] = useState(false);
  const [currentMood, setCurrentMood] = useState<string | null>(null);

  const kpiData: KPICard[] = [
    {
      title: 'Emails Processed',
      value: '2,847',
      change: '+12.5%',
      icon: Mail,
      trend: 'up'
    },
    {
      title: 'Leads Generated',
      value: '156',
      change: '+8.2%',
      icon: Users,
      trend: 'up'
    },
    {
      title: 'Active Projects',
      value: '24',
      change: '+2',
      icon: Target,
      trend: 'up'
    },
    {
      title: 'Days to Goal',
      value: '47',
      change: '-3',
      icon: Calendar,
      trend: 'down'
    }
  ];

  const projects: Project[] = [
    {
      id: '1',
      name: 'Lindy Operations',
      status: 'active',
      progress: 75,
      team: ['JA', 'MB', 'SK'],
      dueDate: '2024-02-15'
    },
    {
      id: '2',
      name: 'AI Content Generation',
      status: 'planning',
      progress: 30,
      team: ['RW', 'LK'],
      dueDate: '2024-02-28'
    },
    {
      id: '3',
      name: 'Customer Analytics',
      status: 'review',
      progress: 90,
      team: ['TH', 'PL', 'MS'],
      dueDate: '2024-02-10'
    },
    {
      id: '4',
      name: 'Security Audit',
      status: 'active',
      progress: 45,
      team: ['CJ', 'NK'],
      dueDate: '2024-03-05'
    }
  ];

  const todayTasks: Task[] = [
    { id: '1', title: 'Review Q1 budget proposals', completed: true, priority: 'high' },
    { id: '2', title: 'Update client presentation deck', completed: false, priority: 'high' },
    { id: '3', title: 'Team standup meeting', completed: true, priority: 'medium' },
    { id: '4', title: 'Code review for authentication module', completed: false, priority: 'medium' },
    { id: '5', title: 'Update documentation', completed: false, priority: 'low' }
  ];

  const todaySchedule: ScheduleItem[] = [
    { id: '1', time: '09:00', title: 'Team Standup', type: 'meeting' },
    { id: '2', time: '10:30', title: 'Client Call - Acme Corp', type: 'meeting' },
    { id: '3', time: '12:00', title: 'Lunch Break', type: 'break' },
    { id: '4', time: '14:00', title: 'Code Review Session', type: 'task' },
    { id: '5', time: '16:00', title: 'Sprint Planning', type: 'meeting' }
  ];

  const agentActivity: AgentActivity[] = [
    {
      id: '1',
      agent: 'Email Assistant',
      action: 'Processed 47 emails',
      timestamp: '2 min ago',
      status: 'success'
    },
    {
      id: '2',
      agent: 'Lead Generator',
      action: 'Identified 3 new prospects',
      timestamp: '15 min ago',
      status: 'success'
    },
    {
      id: '3',
      agent: 'Content Creator',
      action: 'Generating blog post',
      timestamp: '1 hour ago',
      status: 'pending'
    },
    {
      id: '4',
      agent: 'Data Analyzer',
      action: 'Processing customer data',
      timestamp: '2 hours ago',
      status: 'error'
    }
  ];

  const moodOptions = [
    { emoji: '😊', label: 'Great', color: 'bg-green-100 text-green-800' },
    { emoji: '😐', label: 'Okay', color: 'bg-yellow-100 text-yellow-800' },
    { emoji: '😴', label: 'Tired', color: 'bg-blue-100 text-blue-800' },
    { emoji: '😤', label: 'Stressed', color: 'bg-red-100 text-red-800' }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'planning': return 'bg-blue-100 text-blue-800';
      case 'review': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getActivityStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <main className={cn(
        "flex-1 flex transition-all duration-300",
        showChat ? "mr-96" : "mr-0"
      )}>
        <div className="flex-1 overflow-auto">
          <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Good morning! 👋</h1>
                <p className="text-gray-600 mt-1">Here's what's happening with your business today</p>
              </div>
              <Button 
                onClick={() => setShowChat(!showChat)}
                variant="outline"
                className="gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                {showChat ? 'Hide Chat' : 'Show Chat'}
              </Button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {kpiData.map((kpi, index) => {
                const Icon = kpi.icon;
                return (
                  <Card key={index} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">{kpi.title}</p>
                          <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
                        </div>
                        <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                          <Icon className="h-6 w-6 text-blue-600" />
                        </div>
                      </div>
                      <div className="flex items-center mt-4">
                        {kpi.trend === 'up' ? (
                          <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-600 mr-1" />
                        )}
                        <span className={`text-sm font-medium ${
                          kpi.trend === 'up' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {kpi.change}
                        </span>
                        <span className="text-sm text-gray-600 ml-1">from last week</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Mood Check-in */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  How are you feeling today?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  {moodOptions.map((mood) => (
                    <Button
                      key={mood.label}
                      variant={currentMood === mood.label ? "default" : "outline"}
                      onClick={() => setCurrentMood(mood.label)}
                      className="flex-1 h-16 flex-col gap-1"
                    >
                      <span className="text-2xl">{mood.emoji}</span>
                      <span className="text-xs">{mood.label}</span>
                    </Button>
                  ))}
                </div>
                {currentMood && (
                  <p className="mt-4 text-sm text-gray-600">
                    Thanks for sharing! JARVIS will adjust your workflow based on your mood.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Projects */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Active Projects
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {projects.map((project) => (
                      <div key={project.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-gray-900">{project.name}</h4>
                          <Badge className={getStatusColor(project.status)}>
                            {project.status}
                          </Badge>
                        </div>
                        <div className="mb-3">
                          <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                            <span>Progress</span>
                            <span>{project.progress}%</span>
                          </div>
                          <Progress value={project.progress} className="h-2" />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className="flex -space-x-2">
                              {project.team.map((member, idx) => (
                                <Avatar key={idx} className="h-6 w-6 border-2 border-white">
                                  <AvatarFallback className="text-xs bg-blue-100 text-blue-800">
                                    {member}
                                  </AvatarFallback>
                                </Avatar>
                              ))}
                            </div>
                          </div>
                          <span className="text-sm text-gray-500">{project.dueDate}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* JARVIS Brain */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-purple-600" />
                    JARVIS Brain
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Memory Usage</span>
                      <span className="text-sm text-gray-600">68%</span>
                    </div>
                    <Progress value={68} className="h-2" />
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Processing Power</span>
                      <span className="text-sm text-gray-600">84%</span>
                    </div>
                    <Progress value={84} className="h-2" />
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Learning Rate</span>
                      <span className="text-sm text-gray-600">92%</span>
                    </div>
                    <Progress value={92} className="h-2" />
                    
                    <div className="mt-4 p-3 bg-purple-50 rounded-lg">
                      <p className="text-sm text-purple-800">
                        <strong>Current Focus:</strong> Optimizing email workflows and lead qualification processes.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Today's Tasks */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    Today's Tasks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {todayTasks.map((task) => (
                      <div key={task.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                          task.completed ? 'bg-green-500 border-green-500' : 'border-gray-300'
                        }`}>
                          {task.completed && <CheckCircle className="w-3 h-3 text-white" />}
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm ${
                            task.completed ? 'line-through text-gray-500' : 'text-gray-900'
                          }`}>
                            {task.title}
                          </p>
                        </div>
                        <Badge className={getPriorityColor(task.priority)} variant="secondary">
                          {task.priority}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Today's Schedule */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-blue-600" />
                    Today's Schedule
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {todaySchedule.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                        <div className="w-16 text-sm text-gray-600 font-medium">
                          {item.time}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{item.title}</p>
                        </div>
                        <Badge variant="outline" className={
                          item.type === 'meeting' ? 'border-blue-200 text-blue-700' :
                          item.type === 'break' ? 'border-green-200 text-green-700' :
                          'border-purple-200 text-purple-700'
                        }>
                          {item.type}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Agent Activity Feed */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-orange-600" />
                    Agent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {agentActivity.map((activity) => (
                      <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg border">
                        <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-medium text-gray-900">{activity.agent}</p>
                            <Badge className={getActivityStatusColor(activity.status)} variant="secondary">
                              {activity.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">{activity.action}</p>
                          <p className="text-xs text-gray-500 mt-1">{activity.timestamp}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Weather Widget */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sun className="h-5 w-5 text-yellow-500" />
                    Weather
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-gray-900">72°F</p>
                        <p className="text-sm text-gray-600">Partly Cloudy</p>
                      </div>
                      <Sun className="h-12 w-12 text-yellow-500" />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <Cloud className="h-6 w-6 text-gray-400 mx-auto mb-1" />
                        <p className="text-xs text-gray-600">Tomorrow</p>
                        <p className="text-sm font-semibold">68°F</p>
                      </div>
                      <div>
                        <CloudRain className="h-6 w-6 text-blue-400 mx-auto mb-1" />
                        <p className="text-xs text-gray-600">Thu</p>
                        <p className="text-sm font-semibold">65°F</p>
                      </div>
                      <div>
                        <Sun className="h-6 w-6 text-yellow-500 mx-auto mb-1" />
                        <p className="text-xs text-gray-600">Fri</p>
                        <p className="text-sm font-semibold">75°F</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Markets Widget */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-green-600" />
                    Markets
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">S&P 500</p>
                        <p className="text-xs text-gray-600">4,756.50</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        <span className="text-sm text-green-600 font-medium">+0.8%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">NASDAQ</p>
                        <p className="text-xs text-gray-600">14,832.60</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        <span className="text-sm text-green-600 font-medium">+1.2%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">DOW</p>
                        <p className="text-xs text-gray-600">37,863.80</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <TrendingDown className="h-4 w-4 text-red-600" />
                        <span className="text-sm text-red-600 font-medium">-0.3%</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Moto TT Game */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-500" />
                    Moto TT Race
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-900">🏍️</p>
                      <p className="text-sm text-gray-600 mt-2">Next race starts in:</p>
                      <p className="text-lg font-semibold text-blue-600">2:34:12</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Current Leader</span>
                        <span className="text-sm font-semibold">Rider #23</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Best Lap</span>
                        <span className="text-sm font-semibold">1:47.832</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Weather</span>
                        <span className="text-sm font-semibold">Dry</span>
                      </div>
                    </div>
                    <Button className="w-full" variant="outline">
                      View Live Race
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* Chat Panel */}
      {showChat && (
        <div className="fixed right-0 top-0 h-screen w-96 bg-white border-l shadow-lg z-50">
          <ChatInterface />
        </div>
      )}
    </div>
  );
}