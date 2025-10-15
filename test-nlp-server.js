#!/usr/bin/env node

/**
 * Test the true NLP capabilities
 */

import { ScientificNLPProcessor } from './src/nlp/scientific-nlp-processor.js';

async function testTrueNLP() {
  console.log('🧠 Testing TRUE Natural Language Processing');
  console.log('=' .repeat(60));

  const nlp = new ScientificNLPProcessor();

  const testQueries = [
    "What genes interact with BRCA1 in DNA repair pathways?",
    "Show me genes that work together with TP53 but exclude BRCA family members",
    "Which proteins regulate cell division in cancer cells?",
    "Find genes involved in immune response that are expressed in T cells",
    "What are the upstream regulators of apoptosis in breast cancer?",
    "Tell me about genes that cause neurological disorders in mice"
  ];

  for (const query of testQueries) {
    console.log(`\n🔍 Query: "${query}"`);
    console.log('-'.repeat(50));
    
    try {
      const result = await nlp.processQuery(query);
      
      console.log(`✅ Intent: ${result.understanding.intent}`);
      console.log(`✅ Entities: ${JSON.stringify(result.understanding.entities, null, 2)}`);
      console.log(`✅ Context: ${result.understanding.context.join(', ')}`);
      console.log(`✅ Semantic Structure:`);
      console.log(`   Subject: ${result.understanding.semanticParse.subject}`);
      console.log(`   Predicate: ${result.understanding.semanticParse.predicate}`);
      console.log(`   Object: ${result.understanding.semanticParse.object}`);
      console.log(`✅ Generated Query: "${result.structuredQuery}"`);
      console.log(`✅ Results: ${result.results?.entities?.genes?.total || 0} genes found`);
      console.log(`✅ Natural Response: "${result.naturalLanguageResponse}"`);
      
      if (result.results?.entities?.genes?.results?.length > 0) {
        console.log(`   Top result: ${result.results.entities.genes.results[0].symbol} - ${result.results.entities.genes.results[0].name}`);
      }
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }

  console.log('\n🧠 TRUE NLP Test Complete!');
  console.log('Features demonstrated:');
  console.log('• Semantic parsing (subject-predicate-object)');
  console.log('• Intent detection (search, analyze, function, relationship)');
  console.log('• Biological entity extraction');
  console.log('• Context inference');
  console.log('• Natural language generation');
  console.log('• Conversational understanding');
}

testTrueNLP().catch(console.error);