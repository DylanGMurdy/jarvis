'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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

export default function IdeasPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects(data.data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This is permanent and cannot be undone.`)) return;
    try {
      const response = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setProjects(projects.filter(p => p.id !== id));
      }
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), description: description.trim(), status: 'Idea', grade: 'B', category: 'AI Business', progress: 0 })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.data) {
          setProjects(prev => [data.data, ...prev]);
        } else {
          fetchProjects();
        }
        setTitle('');
        setDescription('');
        setIsModalOpen(false);
      }
    } catch (error) {
      console.error('Error creating project:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => { fetchProjects(); }, []);

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Ideas Lab</h1>
            <p className="text-gray-400">Explore and develop new project concepts</p>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition-colors">
            New Project
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12"><div className="text-gray-400">Loading projects...</div></div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">No projects yet</div>
            <p className="text-sm text-gray-500">Click &quot;New Project&quot; to create your first idea</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map(project => (
              <Link href={`/ideas/${project.id}`} key={project.id} className="block">
                <div className="relative bg-gray-900 border border-gray-800 rounded-lg p-6 hover:border-gray-700 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-semibold text-white">{project.title}</h3>
                  </div>
                  {project.description && <p className="text-gray-400 mb-4 text-sm">{project.description}</p>}
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs ${project.status === 'Building' ? 'bg-green-500/20 text-green-400' : project.status === 'Idea' ? 'bg-purple-500/20 text-purple-400' : project.status === 'Planning' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'}`}>{project.status}</span>
                      <span className="text-gray-500">Grade {project.grade}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">{project.progress}%</span>
                      <button onClick={(e) => { e.preventDefault(); handleDeleteProject(project.id, project.title); }} className="p-1 text-gray-600 hover:text-red-400 transition-colors" title="Delete project">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4h6v2"></path></svg>
                      </button>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => { setTitle(''); setDescription(''); setIsModalOpen(false); }}>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-4">New Idea</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Project Name *</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="Enter project name" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none" rows={3} placeholder="Optional description" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setTitle(''); setDescription(''); setIsModalOpen(false); }} className="flex-1 px-4 py-2 text-gray-300 border border-gray-600 rounded-md hover:bg-gray-800 transition-colors">Cancel</button>
                <button type="submit" disabled={!title.trim() || isSubmitting} className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">{isSubmitting ? 'Creating...' : 'Create Project'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
