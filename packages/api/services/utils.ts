import fs from 'fs';
import path from 'path';

export function saveAssetsToFile(data: any, fileName: string) {
    const __dirname = path.dirname(fileName);
    const outputDir = path.join(__dirname, 'output');
    fs.mkdirSync(outputDir, { recursive: true });

        fs.writeFileSync(
            path.join(outputDir, fileName),
            JSON.stringify(
                Object.fromEntries(data),
                (_, value) => typeof value === 'bigint' ? value.toString() : value,
                2
            )
        );
}