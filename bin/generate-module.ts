#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';

const capitalize = (s: string): string =>
  s.charAt(0).toUpperCase() + s.slice(1);

const relativePath = 'src/modules';

const generateModule = (moduleName: string): void => {
  const folderPath: string = path.join(process.cwd(), relativePath, moduleName);

  if (fs.existsSync(folderPath)) {
    console.error(
      `\x1b[31mError: Module "${moduleName}" already exists.\x1b[0m`,
    );
    process.exit(1);
  }

  const files: Record<string, string> = {
    [`${moduleName}.constant.ts`]: `const ${capitalize(
      moduleName,
    )}Constants = {};\n\nexport default ${capitalize(moduleName)}Constants;`,
    [`${moduleName}.controller.ts`]: `const ${capitalize(
      moduleName,
    )}Controller = {};\n\nexport default ${capitalize(moduleName)}Controller;`,
    [`${moduleName}.services.ts`]: `const ${capitalize(
      moduleName,
    )}Service = {};\n\nexport default ${capitalize(moduleName)}Service;`,
    [`${moduleName}.routes.ts`]: `import express from 'express';\n\nconst router = express.Router();\n\nrouter.get('/');\n\nexport const ${capitalize(
      moduleName,
    )}Routes = router;`,
    [`${moduleName}.validation.ts`]: `const ${capitalize(
      moduleName,
    )}Validation = {};\n\nexport default ${capitalize(moduleName)}Validation;`,
    [`${moduleName}.utils.ts`]: `const ${capitalize(
      moduleName,
    )}Utils = {};\n\nexport default ${capitalize(moduleName)}Utils;`,
  };

  fs.ensureDirSync(folderPath);

  for (const [fileName, content] of Object.entries(files)) {
    const filePath: string = path.join(folderPath, fileName);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`\x1b[32mCreated\x1b[0m ${filePath}`);
  }

  console.log(`\x1b[32mModule "${moduleName}" generated successfully.\x1b[0m`);
};

const moduleName: string | undefined = process.argv[2];

if (!moduleName) {
  console.error(
    '\x1b[31mPlease provide a module name. Usage: generate-module <module-name>\x1b[0m',
  );
  process.exit(1);
}

generateModule(moduleName);
