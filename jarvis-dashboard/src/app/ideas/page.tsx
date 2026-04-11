'use client'

import { DashboardLayout } from '@/components/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Lightbulb, Plus, Star, Clock, Users } from 'lucide-react'
import { useState } from 'react'

interface Idea {
  id: string
  title: string
  description: string
  status: 'draft' | 'in-review' | 'approved' | 'implemented'
  priority: 'low' | 'medium' | 'high'
  votes: number
  author: string
  createdAt: string
}

const mockIdeas: Idea[] = [
  {
    id: '1',
    title: 'AI-Powered Code Review',
    description: 'Implement an AI system that automatically reviews code for best practices, security vulnerabilities, and performance optimizations.',
    status: 'in-review',
    priority: 'high',
    votes: 23,
    author: 'John Doe',
    createdAt: '2024-01-15'
  },
  {
    id: '2',
    title: 'Dark Mode for Mobile App',
    description: 'Add a dark theme option to our mobile application to improve user experience during night usage.',
    status: 'approved',
    priority: 'medium',
    votes: 15,
    author: 'Jane Smith',
    createdAt: '2024-01-14'
  },
  {
    id: '3',
    title: 'Real-time Collaboration Features',
    description: 'Enable real-time editing and collaboration features similar to Google Docs for our document editor.',
    status: 'draft',
    priority: 'high',
    votes: 31,
    author: 'Mike Johnson',
    createdAt: '2024-01-13'
  }
]

function getStatusColor(status: Idea['status']) {
  switch (status) {
    case 'draft': return 'bg-gray-600'
    case 'in-review': return 'bg-yellow-600'
    case 'approved': return 'bg-green-600'
    case 'implemented': return 'bg-blue-600'
  }
}

function getPriorityColor(priority: Idea['priority']) {
  switch (priority) {
    case 'low': return 'bg-gray-600'
    case 'medium': return 'bg-yellow-600'
    case 'high': return 'bg-red-600'
  }
}

export default function IdeasLab() {
  const [ideas, setIdeas] = useState<Idea[]>(mockIdeas)
  const [showNewIdeaForm, setShowNewIdeaForm] = useState(false)
  const [newIdea, setNewIdea] = useState({ title: '', description: '', priority: 'medium' as Idea['priority'] })

  const handleSubmitIdea = () => {
    if (newIdea.title.trim() && newIdea.description.trim()) {
      const idea: Idea = {
        id: Date.now().toString(),
        title: newIdea.title,
        description: newIdea.description,
        status: 'draft',
        priority: newIdea.priority,
        votes: 0,
        author: 'Current User',
        createdAt: new Date().toISOString().split('T')[0]
      }
      setIdeas([idea, ...ideas])
      setNewIdea({ title: '', description: '', priority: 'medium' })
      setShowNewIdeaForm(false)
    }
  }

  const handleVote = (ideaId: string) => {
    setIdeas(ideas.map(idea => 
      idea.id === ideaId 
        ? { ...idea, votes: idea.votes + 1 }
        : idea
    ))
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <Lightbulb className="h-8 w-8 text-yellow-400" />
              Ideas Lab
            </h1>
            <p className="text-gray-400 mt-2">Share and collaborate on innovative ideas</p>
          </div>
          <Button 
            onClick={() => setShowNewIdeaForm(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Idea
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Lightbulb className="h-5 w-5 text-yellow-400" />
                <div>
                  <p className="text-sm text-gray-400">Total Ideas</p>
                  <p className="text-2xl font-bold text-white">{ideas.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Star className="h-5 w-5 text-green-400" />
                <div>
                  <p className="text-sm text-gray-400">Approved</p>
                  <p className="text-2xl font-bold text-white">
                    {ideas.filter(idea => idea.status === 'approved').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-yellow-400" />
                <div>
                  <p className="text-sm text-gray-400">In Review</p>
                  <p className="text-2xl font-bold text-white">
                    {ideas.filter(idea => idea.status === 'in-review').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-blue-400" />
                <div>
                  <p className="text-sm text-gray-400">Total Votes</p>
                  <p className="text-2xl font-bold text-white">
                    {ideas.reduce((sum, idea) => sum + idea.votes, 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* New Idea Form */}
        {showNewIdeaForm && (
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Submit New Idea</CardTitle>
              <CardDescription className="text-gray-400">
                Share your innovative idea with the team
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Idea title..."
                value={newIdea.title}
                onChange={(e) => setNewIdea({ ...newIdea, title: e.target.value })}
                className="bg-gray-800 border-gray-700 text-white"
              />
              <Textarea
                placeholder="Describe your idea in detail..."
                value={newIdea.description}
                onChange={(e) => setNewIdea({ ...newIdea, description: e.target.value })}
                className="bg-gray-800 border-gray-700 text-white min-h-[100px]"
              />
              <div className="flex items-center space-x-4">
                <select
                  value={newIdea.priority}
                  onChange={(e) => setNewIdea({ ...newIdea, priority: e.target.value as Idea['priority'] })}
                  className="bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>
                <div className="flex space-x-2">
                  <Button onClick={handleSubmitIdea} className="bg-blue-600 hover:bg-blue-700">
                    Submit Idea
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowNewIdeaForm(false)}
                    className="border-gray-700 text-gray-300 hover:bg-gray-800"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ideas List */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white">All Ideas</h2>
          {ideas.map((idea) => (
            <Card key={idea.id} className="bg-gray-900 border-gray-800">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-white text-lg">{idea.title}</CardTitle>
                    <CardDescription className="text-gray-400 mt-1">
                      by {idea.author} • {idea.createdAt}
                    </CardDescription>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getPriorityColor(idea.priority)}>
                      {idea.priority}
                    </Badge>
                    <Badge className={getStatusColor(idea.status)}>
                      {idea.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-300 mb-4">{idea.description}</p>
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleVote(idea.id)}
                    className="border-gray-700 text-gray-300 hover:bg-gray-800"
                  >
                    <Star className="h-4 w-4 mr-1" />
                    Vote ({idea.votes})
                  </Button>
                  <div className="flex space-x-2">
                    <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white">
                      Comment
                    </Button>
                    <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white">
                      Share
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  )
}