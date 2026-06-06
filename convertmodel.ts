import * as fs from 'fs';

const slimefunPackPath = './Slimefun';

//const slimefunItemsPath = `${slimefunPackPath}/assets/minecraft/items`;
const slimefunItemsPath = `${slimefunPackPath}/overlay_1_21_6_plus/assets/minecraft/items`;

interface SelectModel {
  type: "minecraft:select";
  property: string;
  component: string;
  fallback: any;
  cases: {
    when: any;
    model: any;
  }[];
}

function convertSelectToCondition(select: SelectModel): any {
  let current = select.fallback;
  console.log(select);

  if (select.type !== "minecraft:select") return select;

  // Build from the end so the fallback becomes the next condition.
  for (let i = select.cases.length - 1; i >= 0; i--) {
    const c = select.cases[i];

    current = {
      type: "minecraft:condition",
      property: select.property,
      predicate: select.component,
      value: c?.when,
      on_true: c?.model,
      on_false: current,
    };
  }

  return current;
}

fs.readdirSync(slimefunItemsPath).forEach(file => {
  const slimefunFilePath = `${slimefunItemsPath}/${file}`;
  const slimefunFile = JSON.parse(
    fs.readFileSync(slimefunFilePath, "utf8"),
  ).model as SelectModel;

  const output = convertSelectToCondition(slimefunFile);

  fs.writeFileSync(
    slimefunFilePath,
    JSON.stringify({ model: output }, null, 2),
  );

  console.log(`Converted ${file}`);
});

console.log("Converted!");