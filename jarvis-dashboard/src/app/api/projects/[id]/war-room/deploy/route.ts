import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Anthropic from '@anthropic-ai/sdk';
import { WarRoomAgent, warRoomPrompts, wave1Agents, wave2Agents } from '@/lib/war-room-agents';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

type WarRoomResult = {
  agent: string;
  content: string;
  success: boolean;
  error?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callAgent(agent: WarRoomAgent, projectData: any, retries = 3): Promise<WarRoomResult> {
  const prompt = warRoomPrompts[agent];
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: `${prompt}\n\nProject Data: ${JSON.stringify(projectData, null, 2)}`
        }]
      });
      
      const content = response.content[0]?.type === 'text' ? response.content[0].text : '';
      
      return {
        agent,
        content,
        success: true
      };
    } catch (error: any) {
      if (error?.status === 429 && attempt < retries - 1) {
        // Rate limit hit, wait 5 seconds before retry
        await sleep(5000);
        continue;
      }
      
      return {
        agent,
        content: '',
        success: false,
        error: error?.message || 'Unknown error'
      };
    }
  }
  
  return {
    agent,
    content: '',
    success: false,
    error: 'Max retries exceeded'
  };
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = params.id;
    
    // Get project data
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Create a readable stream for progress updates
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        const results: WarRoomResult[] = [];
        
        try {
          // Wave 1: Executive team with delays
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'wave1_start', message: 'Starting Wave 1: Executive Team' })}\n\n`));
          
          const wave1Delays = [0, 2000, 4000, 6000]; // CFO, CTO, CLO, COO delays
          
          for (let i = 0; i < wave1Agents.length; i++) {
            const agent = wave1Agents[i];
            
            if (i > 0) {
              await sleep(wave1Delays[i]);
            }
            
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'agent_start', agent, wave: 1 })}\n\n`));
            
            const result = await callAgent(agent, project);
            results.push(result);
            
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'agent_complete', agent, wave: 1, success: result.success })}\n\n`));
          }
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'wave1_complete', message: 'Wave 1 Complete' })}\n\n`));
          
          // Wave 2: Department heads in batches
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'wave2_start', message: 'Starting Wave 2: Department Heads' })}\n\n`));
          
          const wave2Batches = [
            ['CMO', 'CSO', 'VP Sales'],
            ['VP Product', 'VP Engineering', 'VP Marketing'],
            ['VP Finance', 'VP Operations', 'Head of Growth'],
            ['Head of Content', 'Head of Design', 'Head of CX'],
            ['SDR', 'Partnerships', 'Customer Success'],
            ['Head of PR', 'Investor Relations', 'Head of Recruiting', 'Master Orchestrator']
          ];
          
          for (let batchIndex = 0; batchIndex < wave2Batches.length; batchIndex++) {
            const batch = wave2Batches[batchIndex];
            
            if (batchIndex > 0) {
              await sleep(4000); // Wait 4 seconds between batches
            }
            
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'batch_start', batch: batchIndex + 1, agents: batch })}\n\n`));
            
            // Fire all agents in this batch simultaneously
            const batchPromises = batch.map(async (agentName) => {
              const agent = agentName as WarRoomAgent;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'agent_start', agent, wave: 2, batch: batchIndex + 1 })}\n\n`));
              
              const result = await callAgent(agent, project);
              
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'agent_complete', agent, wave: 2, batch: batchIndex + 1, success: result.success })}\n\n`));
              
              return result;
            });
            
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
            
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'batch_complete', batch: batchIndex + 1 })}\n\n`));
          }
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'wave2_complete', message: 'Wave 2 Complete' })}\n\n`));
          
          // Save results to database
          const warRoomData = {
            project_id: projectId,
            user_id: user.id,
            results: results.reduce((acc, result) => {
              acc[result.agent] = {
                content: result.content,
                success: result.success,
                error: result.error
              };
              return acc;
            }, {} as Record<string, any>),
            created_at: new Date().toISOString()
          };
          
          const { error: saveError } = await supabase
            .from('war_room_sessions')
            .insert(warRoomData);
          
          if (saveError) {
            console.error('Error saving war room results:', saveError);
          }
          
          // Send final completion message
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            status: 'complete', 
            message: 'War Room Complete', 
            results,
            successCount: results.filter(r => r.success).length,
            totalCount: results.length
          })}\n\n`));
          
        } catch (error: any) {
          console.error('War room error:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            status: 'error', 
            message: error.message || 'Unknown error occurred' 
          })}\n\n`));
        } finally {
          controller.close();
        }
      }
    });
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
    
  } catch (error: any) {
    console.error('War room deploy error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}