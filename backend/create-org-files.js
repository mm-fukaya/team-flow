const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');
const organizations = ['macromill', 'macromill-mint'];

organizations.forEach(orgName => {
  const monthlyFiles = fs.readdirSync(dataDir)
    .filter(file => file.startsWith(orgName + '-monthly-') && file.endsWith('.json'))
    .sort();

  const memberMap = new Map();

  monthlyFiles.forEach(file => {
    const filePath = path.join(dataDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    if (data.activities && Array.isArray(data.activities)) {
      data.activities.forEach(member => {
        if (!memberMap.has(member.login)) {
          memberMap.set(member.login, {
            login: member.login,
            name: member.name || member.login,
            avatar_url: member.avatar_url,
            organization: orgName,
            organizationDisplayName: orgName === 'macromill' ? 'Macromill' : 'Macromill Mint',
            activities: {}
          });
        }
        
        // 月次データを統合
        if (member.activities) {
          Object.assign(memberMap.get(member.login).activities, member.activities);
        }
      });
    }
  });

  const activities = Array.from(memberMap.values());
  
  const outputData = {
    organization: orgName,
    lastUpdated: new Date().toISOString(),
    activities: activities
  };

  const outputPath = path.join(dataDir, orgName + '-activities.json');
  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
  console.log(`Created ${outputPath} with ${activities.length} members`);
}); 