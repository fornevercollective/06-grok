import * as tf from '@tensorflow/tfjs';

export class MLService {
  private models: Map<string, tf.LayersModel> = new Map();

  async createModel(name: string, layers: any[]): Promise<void> {
    const model = tf.sequential();

    layers.forEach((layerConfig) => {
      if (layerConfig.type === 'dense') {
        model.add(tf.layers.dense({
          units: layerConfig.units,
          inputShape: layerConfig.inputShape,
          activation: layerConfig.activation,
        }));
      }
    });

    model.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError',
      metrics: ['mse'],
    });

    this.models.set(name, model);
  }

  async trainModel(
    name: string,
    xData: number[][],
    yData: number[][],
    epochs: number = 100
  ): Promise<tf.History> {
    const model = this.models.get(name);
    if (!model) throw new Error(`Model ${name} not found`);

    const xs = tf.tensor2d(xData);
    const ys = tf.tensor2d(yData);

    const history = await model.fit(xs, ys, {
      epochs,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          console.log(`Epoch ${epoch}: loss = ${logs?.loss}`);
        },
      },
    });

    xs.dispose();
    ys.dispose();

    return history;
  }

  async predict(name: string, input: number[][]): Promise<number[][]> {
    const model = this.models.get(name);
    if (!model) throw new Error(`Model ${name} not found`);

    const inputTensor = tf.tensor2d(input);
    const prediction = model.predict(inputTensor) as tf.Tensor;
    const result = await prediction.array() as number[][];

    inputTensor.dispose();
    prediction.dispose();

    return result;
  }

  // Federated learning simulation
  async federatedUpdate(
    localModel: tf.LayersModel,
    globalWeights: tf.Tensor[]
  ): Promise<tf.Tensor[]> {
    // Simple federated averaging simulation
    const localWeights = localModel.getWeights();
    const updatedWeights: tf.Tensor[] = [];

    for (let i = 0; i < localWeights.length; i++) {
      const avgWeight = tf.add(
        tf.mul(localWeights[i], 0.5),
        tf.mul(globalWeights[i], 0.5)
      );
      updatedWeights.push(avgWeight);
    }

    return updatedWeights;
  }

  // Distributed tensor operations
  async distributedMatrixMultiply(
    matrices: number[][][]
  ): Promise<number[][]> {
    // Simulate distributed computation
    // In reality, this would split the work across peers
    const result = matrices.reduce((acc, matrix) => {
      return acc.map((row, i) =>
        row.map((val, j) => val + (matrix[i]?.[j] || 0))
      );
    });

    return result;
  }

  dispose(): void {
    this.models.forEach((model) => model.dispose());
    this.models.clear();
  }
}

export const mlService = new MLService();