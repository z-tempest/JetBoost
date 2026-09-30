import joblib
from fastapi import FastAPI, Query
import pandas as pd

model_uri = "../../../ml/models/FD004GBM"
data_uri = "../../../data/FE_data/test_FD004"

# Load the model
model = joblib.load(model_uri)
model.set_params(device="cpu")

app = FastAPI()

df = pd.read_parquet(data_uri)
df = df.drop(columns="RUL")
df = df.set_index("Engine")


@app.get("/predict")
def inference(target_idxs: list[int] = Query(...), cycles: list[int] = Query(...)):
    """Return FD004GBM model predictions for a batch of engines,
    each at its own time cycle.

    Args:
        target_idxs (list[int]): Engine indices (e.g. 1..100) to predict on.
        cycles (list[int]): Time cycle for each engine. cycles[i] belongs to
            target_idxs[i], so both lists must be the same length.

    Returns:
        dict: {"Predicted RUL": [...]} with one prediction per engine,
            in the same order as target_idxs.
    """

    lookup = dict(zip(target_idxs, cycles))
    wanted = df.index.map(lookup)
    targets = df[df["Time"] == wanted]
    targets = targets.loc[target_idxs]
    rul_pred = model.predict(targets)

    return {"Predicted RUL": rul_pred.tolist()}
