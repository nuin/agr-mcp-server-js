#!/usr/bin/env node

/**
 * Standalone NLP MCP Server for Claude Code
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { ScientificNLPProcessor } from './nlp/scientific-nlp-processor.js';

const nlpProcessor = new ScientificNLPProcessor();

// Create the MCP server
const server = new Server(
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

// Define tools
const tools = [
  {
    name: 'process_natural_query',
    description: 'Process natural language scientific queries with semantic understanding (TRUE NLP)',
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
];

// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: tools
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      case 'process_natural_query': {
        const nlpResult = await nlpProcessor.processQuery(args.query);
        
        // Store conversation history for follow-ups
        if (!global.conversationHistory) {
          global.conversationHistory = [];
        }
        
        const conversationEntry = {
          id: args.conversation_id || 'conv_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now(),
          timestamp: new Date().toISOString(),
          query: args.query,
          result: nlpResult
        };
        
        global.conversationHistory.push(conversationEntry);
        
        result = {
          naturalLanguageResponse: nlpResult.naturalLanguageResponse,
          understanding: nlpResult.understanding,
          resultsFound: nlpResult.results?.entities?.genes?.total || 0,
          topResults: nlpResult.results?.entities?.genes?.results?.slice(0, 3) || [],
          conversationId: conversationEntry.id,
          semanticBreakdown: {
            subject: nlpResult.understanding.semanticParse.subject,
            predicate: nlpResult.understanding.semanticParse.predicate,
            object: nlpResult.understanding.semanticParse.object
          }
        };
        break;
      }
      
      case 'continue_conversation': {
        // Find conversation history
        const history = (global.conversationHistory || []).filter(entry => 
          entry.id === args.conversation_id
        );
        
        if (history.length === 0) {
          throw new Error(`Conversation ${args.conversation_id} not found`);
        }
        
        const nlpResult = await nlpProcessor.handleFollowUp(args.query, history);
        
        // Add to history
        global.conversationHistory.push({
          id: args.conversation_id,
          timestamp: new Date().toISOString(),
          query: args.query,
          result: nlpResult,
          isFollowUp: true
        });
        
        result = {
          naturalLanguageResponse: nlpResult.naturalLanguageResponse,
          understanding: nlpResult.understanding,
          contextResolved: nlpResult.originalQuery !== args.query,
          resolvedQuery: nlpResult.originalQuery,
          resultsFound: nlpResult.results?.entities?.genes?.total || 0
        };
        break;
      }
      
      case 'explain_understanding': {
        const nlpResult = await nlpProcessor.processQuery(args.query);
        
        result = {
          originalQuery: args.query,
          semanticBreakdown: {
            subject: nlpResult.understanding.semanticParse.subject,
            predicate: nlpResult.understanding.semanticParse.predicate,
            object: nlpResult.understanding.semanticParse.object,
            modifiers: nlpResult.understanding.semanticParse.modifiers,
            negations: nlpResult.understanding.semanticParse.negations
          },
          detectedIntent: nlpResult.understanding.intent,
          extractedEntities: nlpResult.understanding.entities,
          biologicalContext: nlpResult.understanding.context,
          generatedStructuredQuery: nlpResult.structuredQuery,
          processingSteps: [
            '1. Parse semantic structure (subject-predicate-object)',
            '2. Extract biological entities (genes, species, processes)',
            '3. Detect user intent (search, analyze, compare, etc.)',
            '4. Infer biological context and relationships',
            '5. Build structured query from understanding',
            '6. Execute query against knowledge base',
            '7. Generate natural language response'
          ],
          resultsFound: nlpResult.results?.entities?.genes?.total || 0
        };
        break;
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };

  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error.message,
            tool: name,
            timestamp: new Date().toISOString()
          }, null, 2)
        }
      ],
      isError: true
    };
  }
});

// Start the server
const transport = new StdioServerTransport();
server.connect(transport);

console.error('NLP MCP Server started successfully');