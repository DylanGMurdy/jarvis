'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface Project {
  id: string;
  title: string;
  description: string;
  status: string;
  grade: string;
  category: string;
  progress: number;
  created_at: string;
}

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function NewProjectModal({ isOpen, onClose, onSuccess }: NewProjectModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          status: 'Idea',
          grade: 'B',
          category: 'AI Business',
          progress: 0
        })
      });
      
      if (response.ok) {
        setTitle('');
        setDescription('');
        onSuccess();
        onClose();
      }
    } catch (error) {
      console.error('Error creating project:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setTitle('');
    setDescription('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <h3 className="text-xl font-bold text-white mb-4">New Project</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Project Name *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Enter project name"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              rows={3}
              placeholder="Optional description"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 px-4 py-2 text-gray-300 border border-gray-600 rounded-md hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || isSubmitting}
              className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProjectCard({ project, onDelete }: { project: Project; onDelete: (id: string) => void }) {
  const handleDelete = () => {
    if (confirm(`Delete ${project.title}? This cannot be undone.`)) {
      onDelete(project.id);
    }
  };

  return (
    <div className="relative bg-gray-900 border border-gray-800 rounded-lg p-6 hover:border-gray-700 transition-colors">
      <button
        onClick={handleDelete}
        className="absolute top-3 right-3 text-gray-500 hover:text-red-400 text-lg leading-none transition-colors"
        title="Delete project"
      >
        ×
      </button>
      <div className="flex items-start justify-between mb-3 pr-6">
        <h3 className="text-lg font-semibold text-white">{project.title}</h3>
      </div>
      {project.description && (
        <p className="text-gray-400 mb-4 text-sm">{project.description}</p>
      )}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-3">
          <span className={`px-2 py-1 rounded text-xs ${
            project.status === 'Active' ? 'bg-green-500/20 text-green-400' :
            project.status === 'Idea' ? 'bg-purple-500/20 text-purple-400' :
            'bg-gray-500/20 text-gray-400'
          }`}>
            {project.status}
          </span>
          <span className="text-gray-500">Grade {project.grade}</span>
        </div>
        <span className="text-gray-500">{project.progress}%</span>
      </div>
    </div>
  );
}

export default function IdeasPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClientComponentClient();

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setProjects(projects.filter(p => p.id !== id));
      }
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const ideaProjects = projects.filter(p => p.status === 'Idea');

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Ideas Lab</h1>
            <p className="text-gray-400">Explore and develop new project concepts</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition-colors"
          >
            New Project
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-400">Loading projects...</div>
          </div>
        ) : (
          <>
            {ideaProjects.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">No ideas yet</div>
                <p className="text-sm text-gray-500">Click "New Project" to create your first idea</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {ideaProjects.map(project => (
                  <ProjectCard 
                    key={project.id} 
                    project={project} 
                    onDelete={handleDeleteProject}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
      
      <NewProjectModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchProjects}
      />
    </div>
  );
}