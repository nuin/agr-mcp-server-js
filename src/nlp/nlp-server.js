#!/usr/bin/env node

/**
 * Natural Language Processing MCP Server
 * Provides true NLP capabilities for scientific queries
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { ScientificNLPProcessor } from './scientific-nlp-processor.js';

class NLPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'agr-nlp-server',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );
    
    this.nlpProcessor = new ScientificNLPProcessor();
    this.conversationHistory = [];
    this.setupHandlers();
  }

  setupHandlers() {
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        switch (name) {
          case 'process_natural_query':
            return await this.processNaturalQuery(args);
          case 'continue_conversation':
            return await this.continueConversation(args);
          case 'explain_understanding':
            return await this.explainUnderstanding(args);
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        throw new McpError(ErrorCode.InternalError, error.message);
      }
    });

    this.server.setRequestHandler('tools/list', async () => {
      return {
        tools: [
          {
            name: 'process_natural_query',
            description: 'Process natural language scientific queries with semantic understanding',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Natural language query about genes, diseases, or biological processes'
                },
                conversation_id: {
                  type: 'string',
                  description: 'Optional conversation ID for context'
                }
              },
              required: ['query']
            }
          },
          {
            name: 'continue_conversation',
            description: 'Continue a conversation with follow-up questions and context awareness',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Follow-up question or query'
                },
                conversation_id: {
                  type: 'string',
                  description: 'Conversation ID for context'
                }
              },
              required: ['query', 'conversation_id']
            }
          },
          {
            name: 'explain_understanding',
            description: 'Explain how the NLP system understood and processed a query',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Query to analyze and explain'
                }
              },
              required: ['query']
            }
          }
        ]
      };
    });
  }

  async processNaturalQuery(args) {
    const { query, conversation_id } = args;
    
    console.log(`🧠 Processing natural language query: "${query}"`);
    
    const result = await this.nlpProcessor.processQuery(query);
    
    // Store in conversation history
    const conversationEntry = {
      id: conversation_id || this.generateConversationId(),
      timestamp: new Date().toISOString(),
      query,
      result
    };
    
    this.conversationHistory.push(conversationEntry);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            naturalLanguageResponse: result.naturalLanguageResponse,
            understanding: result.understanding,
            resultsFound: result.results?.entities?.genes?.total || 0,
            topResults: result.results?.entities?.genes?.results?.slice(0, 3) || [],
            conversationId: conversationEntry.id
          }, null, 2)
        }
      ]
    };
  }

  async continueConversation(args) {
    const { query, conversation_id } = args;
    
    // Find conversation history
    const history = this.conversationHistory.filter(entry => 
      entry.id === conversation_id
    );
    
    if (history.length === 0) {
      throw new Error(`Conversation ${conversation_id} not found`);
    }
    
    console.log(`🗣️ Continuing conversation ${conversation_id}: "${query}"`);
    
    const result = await this.nlpProcessor.handleFollowUp(query, history);
    
    // Add to history
    this.conversationHistory.push({
      id: conversation_id,
      timestamp: new Date().toISOString(),
      query,
      result,
      isFollowUp: true
    });
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            naturalLanguageResponse: result.naturalLanguageResponse,
            understanding: result.understanding,
            contextResolved: result.originalQuery !== query,
            resolvedQuery: result.originalQuery,
            resultsFound: result.results?.entities?.genes?.total || 0
          }, null, 2)
        }
      ]
    };
  }

  async explainUnderstanding(args) {
    const { query } = args;
    
    console.log(`🔍 Explaining understanding of: "${query}"`);
    
    const result = await this.nlpProcessor.processQuery(query);
    
    const explanation = {
      originalQuery: query,
      semanticBreakdown: {
        subject: result.understanding.semanticParse.subject,
        predicate: result.understanding.semanticParse.predicate,
        object: result.understanding.semanticParse.object,
        modifiers: result.understanding.semanticParse.modifiers,
        negations: result.understanding.semanticParse.negations
      },
      detectedIntent: result.understanding.intent,
      extractedEntities: result.understanding.entities,
      biologicalContext: result.understanding.context,
      generatedStructuredQuery: result.structuredQuery,
      processingSteps: [
        '1. Parse semantic structure (subject-predicate-object)',
        '2. Extract biological entities (genes, species, processes)',
        '3. Detect user intent (search, analyze, compare, etc.)',
        '4. Infer biological context and relationships',
        '5. Build structured query from understanding',
        '6. Execute query against knowledge base',
        '7. Generate natural language response'
      ]
    };
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(explanation, null, 2)
        }
      ]
    };
  }

  generateConversationId() {
    return 'conv_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('🧠 AGR NLP Server running with true natural language processing');
  }
}

// Start server
const server = new NLPServer();
server.run().catch(console.error);