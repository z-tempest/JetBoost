from sklearn.model_selection import train_test_split

def parse_targets(df):
    df = df.index.unique()
    features = df.drop(columns=['Engine', 'RUL'])
    targets = df['RUL']

    return features, targets