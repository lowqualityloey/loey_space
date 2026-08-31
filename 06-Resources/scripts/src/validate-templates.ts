// Template validation script for tag and properties consistency
import * as fs from 'fs';
import * as path from 'path';

const workspaceRoot = __dirname;
const templatesPath = path.resolve(__dirname, '../../99-Templates');

// Expected required properties for each template type
const expectedProperties = {
  'project': ['created', 'updated', 'type', 'status', 'priority', 'area', 'tags'],
  'learning': ['created', 'updated', 'type', 'status', 'area', 'tags'],
  'snippet': ['created', 'updated', 'type', 'status', 'area', 'tags'],
  'resource': ['created', 'updated', 'type', 'status', 'area', 'tags'],
  'concept': ['created', 'updated', 'type', 'status', 'area', 'tags'],
  'daily': ['created', 'updated', 'type', 'area', 'tags'],
  'personal': ['created', 'updated', 'type', 'status', 'area', 'tags'],
  'review': ['created', 'updated', 'type', 'status', 'area', 'tags'],
  'triage': ['created', 'updated', 'type', 'status', 'area', 'priority', 'tags']
};

// Expected tag structure
const requiredTagNamespaces = ['type', 'area', 'status'];

function validateTemplate(templateName, content) {
  console.log(`\n🔍 Validating ${templateName}...`);

  // Extract YAML frontmatter
  const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!yamlMatch) {
    console.log('❌ Missing YAML frontmatter');
    return false;
  }

  const yamlContent = yamlMatch[1];
  const lines = yamlContent.split('\n');
  const props: any = {};
  let inTags = false;
  const tags = [];

  for (const line of lines) {
    if (line.trim() === '') continue;

    if (inTags) {
      if (line.trim().startsWith('-')) {
        const tag = line.trim().substring(1).trim();
        tags.push(tag);
      } else {
        inTags = false;
      }
    }

    if (!inTags) {
      const propMatch = line.match(/^(\w+):\s*(.*)$/);
      if (propMatch) {
        const [_, key, value] = propMatch;
        props[key] = value.trim() || true;
        if (key === 'tags') {
          inTags = true;
        }
      }
    }
  }

  // Determine template type
  const type = props.type || 'unknown';
  const expected = expectedProperties[type] || [];

  // Check required properties
  let isValid = true;
  for (const prop of expected) {
    if (!props[prop]) {
      console.log(`❌ Missing property: ${prop}`);
      isValid = false;
    }
  }

  // Check tag structure
  const tagNamespaces = new Set();
  for (const tag of tags) {
    const namespace = tag.split('/')[0];
    tagNamespaces.add(namespace);
  }

  for (const namespace of requiredTagNamespaces) {
    if (!tagNamespaces.has(namespace)) {
      console.log(`⚠️ Missing ${namespace}/* tag`);
    }
  }

  // Check for dynamic date placeholders
  if (!content.includes('<% tp.date.now("YYYY-MM-DD") %>')) {
    console.log('⚠️ Missing dynamic date template');
  }

  if (isValid) {
    console.log(`✅ ${templateName} passes validation`);
  }

  return isValid;
}

function validateAllTemplates() {
  console.log('📋 Template Validation Report');
  console.log('=' .repeat(40));

  try {
    const files = fs.readdirSync(templatesPath);
    let allValid = true;

    for (const file of files) {
      if (file.endsWith('.md')) {
        const content = fs.readFileSync(path.join(templatesPath, file), 'utf8');
        const isValid = validateTemplate(file, content);
        allValid = allValid && isValid;
      }
    }

    console.log('\n' + '=' .repeat(40));
    if (allValid) {
      console.log('🎉 All templates are properly structured!');
    } else {
      console.log('⚠️ Some templates need attention');
    }

  } catch (error) {
    console.error('❌ Error reading templates:', error.message);
  }
}

// Run validation
validateAllTemplates();