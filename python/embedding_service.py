#!/usr/bin/env python3
"""
Advanced Faculty Similarity Service using Sentence Transformers and HDBSCAN
"""
import json
import sys
import numpy as np
import pandas as pd
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer
import hdbscan
from umap import UMAP
import warnings
warnings.filterwarnings('ignore')

class FacultySimilarityService:
    def __init__(self):
        self.model = None
        self.embeddings_cache = {}

    def initialize_model(self, model_name='all-MiniLM-L6-v2'):
        """Initialize the sentence transformer model"""
        try:
            self.model = SentenceTransformer(model_name)
            return True
        except Exception as e:
            print(f"Error initializing model: {e}", file=sys.stderr)
            return False

    def generate_embeddings(self, texts):
        """Generate embeddings for a list of texts"""
        if not self.model:
            if not self.initialize_model():
                return None

        try:
            # Clean and prepare texts
            cleaned_texts = [self.clean_text(text) for text in texts]
            embeddings = self.model.encode(cleaned_texts, convert_to_tensor=False)
            return embeddings.tolist()
        except Exception as e:
            print(f"Error generating embeddings: {e}", file=sys.stderr)
            return None

    def clean_text(self, text):
        """Clean and preprocess text"""
        if not text or pd.isna(text):
            return ""

        # Remove excessive whitespace and newlines
        text = ' '.join(text.split())

        # Remove common separators and clean up
        text = text.replace('\r\n', ' ').replace('\n', ' ').replace('\r', ' ')
        text = text.replace(';', ',').replace('  ', ' ')

        return text.strip()

    def calculate_similarity_matrix(self, embeddings):
        """Calculate cosine similarity matrix"""
        try:
            embeddings_array = np.array(embeddings)
            similarity_matrix = cosine_similarity(embeddings_array)
            return similarity_matrix.tolist()
        except Exception as e:
            print(f"Error calculating similarity: {e}", file=sys.stderr)
            return None

    def find_similar_faculty(self, target_embedding, all_embeddings, faculty_data, top_k=10, threshold=0.1):
        """Find most similar faculty members"""
        try:
            target_array = np.array([target_embedding])
            embeddings_array = np.array(all_embeddings)

            similarities = cosine_similarity(target_array, embeddings_array)[0]

            # Create results with similarity scores
            results = []
            for i, similarity in enumerate(similarities):
                if similarity >= threshold:
                    result = faculty_data[i].copy()
                    result['similarity'] = float(similarity)
                    results.append(result)

            # Sort by similarity and return top k
            results.sort(key=lambda x: x['similarity'], reverse=True)
            return results[:top_k]

        except Exception as e:
            print(f"Error finding similar faculty: {e}", file=sys.stderr)
            return []

    def perform_clustering(self, embeddings, faculty_data, min_cluster_size=3):
        """Perform HDBSCAN clustering on embeddings"""
        try:
            embeddings_array = np.array(embeddings)

            # Use UMAP for dimensionality reduction first
            umap_reducer = UMAP(n_components=10, random_state=42)
            reduced_embeddings = umap_reducer.fit_transform(embeddings_array)

            # Perform HDBSCAN clustering
            clusterer = hdbscan.HDBSCAN(
                min_cluster_size=min_cluster_size,
                metric='euclidean',
                cluster_selection_method='eom'
            )

            cluster_labels = clusterer.fit_predict(reduced_embeddings)

            # Organize results by cluster
            clusters = {}
            for i, label in enumerate(cluster_labels):
                if label != -1:  # -1 indicates noise/outlier
                    if label not in clusters:
                        clusters[label] = []

                    faculty_info = faculty_data[i].copy()
                    faculty_info['cluster_id'] = int(label)
                    faculty_info['cluster_probability'] = float(clusterer.probabilities_[i])
                    clusters[label].append(faculty_info)

            # Convert to list format
            cluster_list = []
            for cluster_id, members in clusters.items():
                cluster_list.append({
                    'cluster_id': int(cluster_id),
                    'size': len(members),
                    'members': members
                })

            return {
                'clusters': cluster_list,
                'outliers': len([l for l in cluster_labels if l == -1]),
                'total_clusters': len(clusters)
            }

        except Exception as e:
            print(f"Error performing clustering: {e}", file=sys.stderr)
            return None

def main():
    if len(sys.argv) < 2:
        print("Usage: python embedding_service.py <command> [args...]", file=sys.stderr)
        sys.exit(1)

    command = sys.argv[1]
    service = FacultySimilarityService()

    try:
        if command == "generate_embeddings":
            # Expect JSON input with texts array
            input_data = json.loads(sys.stdin.read())
            texts = input_data.get('texts', [])

            embeddings = service.generate_embeddings(texts)
            if embeddings:
                result = {'success': True, 'embeddings': embeddings}
            else:
                result = {'success': False, 'error': 'Failed to generate embeddings'}

            print(json.dumps(result))

        elif command == "find_similar":
            # Expect JSON input with target_embedding, all_embeddings, faculty_data
            input_data = json.loads(sys.stdin.read())
            target_embedding = input_data.get('target_embedding')
            all_embeddings = input_data.get('all_embeddings')
            faculty_data = input_data.get('faculty_data')
            top_k = input_data.get('top_k', 10)
            threshold = input_data.get('threshold', 0.1)

            results = service.find_similar_faculty(
                target_embedding, all_embeddings, faculty_data, top_k, threshold
            )

            result = {'success': True, 'similar_faculty': results}
            print(json.dumps(result))

        elif command == "cluster_faculty":
            # Expect JSON input with embeddings and faculty_data
            input_data = json.loads(sys.stdin.read())
            embeddings = input_data.get('embeddings')
            faculty_data = input_data.get('faculty_data')
            min_cluster_size = input_data.get('min_cluster_size', 3)

            clustering_result = service.perform_clustering(embeddings, faculty_data, min_cluster_size)
            if clustering_result:
                result = {'success': True, 'clustering': clustering_result}
            else:
                result = {'success': False, 'error': 'Failed to perform clustering'}

            print(json.dumps(result))

        elif command == "test":
            # Test if all dependencies are available
            if service.initialize_model():
                result = {'success': True, 'message': 'All dependencies loaded successfully'}
            else:
                result = {'success': False, 'error': 'Failed to initialize model'}

            print(json.dumps(result))

        else:
            result = {'success': False, 'error': f'Unknown command: {command}'}
            print(json.dumps(result))

    except Exception as e:
        result = {'success': False, 'error': str(e)}
        print(json.dumps(result))
        sys.exit(1)

if __name__ == "__main__":
    main()