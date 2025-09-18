#!/usr/bin/env python3
"""
Advanced Faculty Similarity Service with Clustering
Includes sentence transformers, clustering, and topic modeling
"""
import json
import sys
import numpy as np
import pandas as pd
from collections import Counter

def initialize_model():
    """Initialize the sentence transformer model"""
    try:
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer('all-MiniLM-L6-v2')
        return model
    except ImportError:
        print("sentence-transformers not installed. Install with: pip install sentence-transformers", file=sys.stderr)
        return None
    except Exception as e:
        print(f"Error initializing model: {e}", file=sys.stderr)
        return None

def clean_text(text):
    """Clean and preprocess text"""
    if not text or pd.isna(text):
        return ""

    # Remove excessive whitespace and newlines
    text = ' '.join(text.split())

    # Remove common separators and clean up
    text = text.replace('\r\n', ' ').replace('\n', ' ').replace('\r', ' ')
    text = text.replace(';', ',').replace('  ', ' ')

    return text.strip()

def generate_embeddings(texts, model):
    """Generate embeddings for a list of texts"""
    try:
        cleaned_texts = [clean_text(text) for text in texts]
        embeddings = model.encode(cleaned_texts, convert_to_tensor=False)
        return embeddings.tolist()
    except Exception as e:
        print(f"Error generating embeddings: {e}", file=sys.stderr)
        return None

def calculate_cosine_similarity(embedding1, embedding2):
    """Calculate cosine similarity between two embeddings"""
    try:
        from sklearn.metrics.pairwise import cosine_similarity
        similarity = cosine_similarity([embedding1], [embedding2])[0][0]
        return float(similarity)
    except ImportError:
        # Fallback to manual calculation if sklearn not available
        dot_product = sum(a * b for a, b in zip(embedding1, embedding2))
        magnitude1 = sum(a * a for a in embedding1) ** 0.5
        magnitude2 = sum(b * b for b in embedding2) ** 0.5

        if magnitude1 == 0 or magnitude2 == 0:
            return 0.0

        return dot_product / (magnitude1 * magnitude2)

def find_similar_faculty(target_embedding, all_embeddings, faculty_data, top_k=10, threshold=0.1):
    """Find most similar faculty members"""
    try:
        results = []

        for i, embedding in enumerate(all_embeddings):
            similarity = calculate_cosine_similarity(target_embedding, embedding)

            if similarity >= threshold:
                result = faculty_data[i].copy()
                result['similarity'] = similarity
                results.append(result)

        # Sort by similarity and return top k
        results.sort(key=lambda x: x['similarity'], reverse=True)
        return results[:top_k]

    except Exception as e:
        print(f"Error finding similar faculty: {e}", file=sys.stderr)
        return []

def main():
    if len(sys.argv) < 2:
        print("Usage: python simple_embedding_service.py <command> [args...]", file=sys.stderr)
        sys.exit(1)

    command = sys.argv[1]

    try:
        if command == "test":
            # Test if all dependencies are available
            model = initialize_model()
            if model:
                result = {'success': True, 'message': 'Dependencies loaded successfully'}
            else:
                result = {'success': False, 'error': 'Failed to initialize model'}

            print(json.dumps(result))

        elif command == "generate_embeddings":
            # Expect JSON input with texts array
            input_data = json.loads(sys.stdin.read())
            texts = input_data.get('texts', [])

            model = initialize_model()
            if not model:
                result = {'success': False, 'error': 'Failed to initialize model'}
            else:
                embeddings = generate_embeddings(texts, model)
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

            results = find_similar_faculty(
                target_embedding, all_embeddings, faculty_data, top_k, threshold
            )

            result = {'success': True, 'similar_faculty': results}
            print(json.dumps(result))

        elif command == "cluster_faculty":
            # Expect JSON input with embeddings, faculty_data, min_cluster_size
            input_data = json.loads(sys.stdin.read())
            embeddings = np.array(input_data.get('embeddings', []))
            faculty_data = input_data.get('faculty_data', [])
            min_cluster_size = input_data.get('min_cluster_size', 3)

            clustering_result = cluster_faculty_embeddings(embeddings, faculty_data, min_cluster_size)

            if clustering_result:
                result = {'success': True, 'clustering': clustering_result}
            else:
                result = {'success': False, 'error': 'Clustering failed'}

            print(json.dumps(result))

        elif command == "analyze_topics":
            # Expect JSON input with faculty data for topic analysis
            input_data = json.loads(sys.stdin.read())
            faculty_data = input_data.get('faculty_data', [])
            num_topics = input_data.get('num_topics', 10)

            topics_result = analyze_research_topics(faculty_data, num_topics)

            if topics_result:
                result = {'success': True, 'topics': topics_result}
            else:
                result = {'success': False, 'error': 'Topic analysis failed'}

            print(json.dumps(result))

        else:
            result = {'success': False, 'error': f'Unknown command: {command}'}
            print(json.dumps(result))

    except Exception as e:
        result = {'success': False, 'error': str(e)}
        print(json.dumps(result))
        sys.exit(1)

def cluster_faculty_embeddings(embeddings, faculty_data, min_cluster_size=3):
    """
    Cluster faculty using their embeddings with multiple algorithms
    """
    try:
        from sklearn.cluster import DBSCAN, KMeans
        from sklearn.preprocessing import StandardScaler
        from sklearn.metrics import silhouette_score
        import umap

        if len(embeddings) < min_cluster_size:
            return None

        # Normalize embeddings
        scaler = StandardScaler()
        embeddings_scaled = scaler.fit_transform(embeddings)

        # Reduce dimensionality for better clustering
        reducer = umap.UMAP(n_components=min(50, len(embeddings)-1), random_state=42)
        embeddings_reduced = reducer.fit_transform(embeddings_scaled)

        # Try DBSCAN first (density-based like HDBSCAN)
        dbscan = DBSCAN(eps=0.5, min_samples=min_cluster_size)
        dbscan_labels = dbscan.fit_predict(embeddings_reduced)

        # If DBSCAN creates too few clusters, fall back to K-means
        n_clusters_dbscan = len(set(dbscan_labels)) - (1 if -1 in dbscan_labels else 0)

        if n_clusters_dbscan < 2:
            # Estimate optimal number of clusters using elbow method
            n_clusters = min(max(len(embeddings) // 10, 3), 15)
            kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
            labels = kmeans.fit_predict(embeddings_reduced)
        else:
            labels = dbscan_labels

        # Calculate silhouette score for quality assessment
        if len(set(labels)) > 1:
            silhouette_avg = silhouette_score(embeddings_reduced, labels)
        else:
            silhouette_avg = -1

        # Organize results by clusters
        clusters = {}
        outliers = 0

        for i, label in enumerate(labels):
            if label == -1:  # Outlier
                outliers += 1
                continue

            if label not in clusters:
                clusters[label] = []

            faculty_member = faculty_data[i].copy()
            faculty_member['cluster_id'] = int(label)
            faculty_member['cluster_probability'] = 1.0  # Full membership for hard clustering
            clusters[label].append(faculty_member)

        # Convert to desired format
        cluster_list = []
        for cluster_id, members in clusters.items():
            cluster_list.append({
                'cluster_id': int(cluster_id),
                'size': len(members),
                'members': members
            })

        # Sort clusters by size (largest first)
        cluster_list.sort(key=lambda x: x['size'], reverse=True)

        return {
            'clusters': cluster_list,
            'outliers': outliers,
            'total_clusters': len(cluster_list),
            'silhouette_score': float(silhouette_avg),
            'algorithm_used': 'DBSCAN' if n_clusters_dbscan >= 2 else 'K-means'
        }

    except Exception as e:
        print(f"Error in clustering: {e}", file=sys.stderr)
        return None

def analyze_research_topics(faculty_data, num_topics=10):
    """
    Analyze research topics from faculty keywords using simple keyword extraction
    """
    try:
        import re

        # Collect all keywords
        all_keywords = []
        for faculty in faculty_data:
            keywords = faculty.get('keywords', '')
            if keywords:
                # Clean and split keywords
                cleaned = re.sub(r'[^\w\s,;-]', ' ', keywords.lower())
                words = re.findall(r'\b[a-z]{3,}\b', cleaned)
                all_keywords.extend(words)

        # Count keyword frequencies
        keyword_counts = Counter(all_keywords)

        # Remove common stop words
        stop_words = {'and', 'the', 'for', 'with', 'from', 'that', 'this', 'are', 'was', 'were',
                     'been', 'have', 'has', 'had', 'will', 'would', 'could', 'should', 'may',
                     'can', 'research', 'study', 'analysis', 'using', 'based', 'approach'}

        filtered_counts = {k: v for k, v in keyword_counts.items()
                          if k not in stop_words and len(k) > 3}

        # Get top topics
        top_topics = []
        # Convert back to Counter for most_common method
        filtered_counter = Counter(filtered_counts)
        for i, (keyword, count) in enumerate(filtered_counter.most_common(num_topics)):
            # Find faculty associated with this topic
            associated_faculty = []
            for faculty in faculty_data:
                keywords = faculty.get('keywords', '').lower()
                if keyword in keywords:
                    associated_faculty.append({
                        'faculty_id': faculty.get('faculty_id'),
                        'name': faculty.get('name'),
                        'department': faculty.get('department', 'Unknown')
                    })

            top_topics.append({
                'topic_id': i,
                'keyword': keyword,
                'frequency': count,
                'faculty_count': len(associated_faculty),
                'associated_faculty': associated_faculty[:10]  # Limit to top 10
            })

        return {
            'topics': top_topics,
            'total_keywords': len(all_keywords),
            'unique_keywords': len(keyword_counts),
            'coverage': len([f for f in faculty_data if f.get('keywords')])
        }

    except Exception as e:
        print(f"Error in topic analysis: {e}", file=sys.stderr)
        return None

if __name__ == "__main__":
    main()