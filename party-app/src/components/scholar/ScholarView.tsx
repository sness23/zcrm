import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import { ExternalLink, BookOpen, Users, Award, Link as LinkIcon } from 'lucide-react';

interface ScholarViewProps {
  partyId: string;
}

interface ScholarData {
  scholar_id: string;
  frontmatter: {
    author_id: string;
    name?: string;
    affiliations?: string;
    email?: string;
    website?: string;
    thumbnail?: string;
    total_articles?: number;
    total_citations?: number;
    h_index?: number;
    i10_index?: number;
    scholar_url?: string;
    tags?: string[];
  };
  body: string;
  file_path: string;
}

async function fetchScholarFile(partyId: string): Promise<ScholarData> {
  const response = await fetch(`http://localhost:9600/api/researchers/${partyId}/scholar-file`);

  if (!response.ok) {
    throw new Error('Scholar data not available');
  }

  return response.json();
}

export function ScholarView({ partyId }: ScholarViewProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['scholar-file', partyId],
    queryFn: () => fetchScholarFile(partyId),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-500">Loading scholar data...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <BookOpen className="h-6 w-6 text-yellow-400" />
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-yellow-800">
                No Scholar Data Available
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  This party doesn't have detailed scholar data available yet.
                  Scholar data is sourced from Google Scholar profiles.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { frontmatter, body } = data;

  return (
    <div className="scholar-view p-8 max-w-5xl mx-auto">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-start gap-6">
          {frontmatter.thumbnail && (
            <img
              src={frontmatter.thumbnail}
              alt={frontmatter.name || 'Scholar'}
              className="w-32 h-32 rounded-full border-4 border-gray-200 flex-shrink-0"
            />
          )}

          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {frontmatter.name || 'Scholar Profile'}
            </h1>

            {frontmatter.affiliations && (
              <p className="text-xl text-gray-600 mb-4">{frontmatter.affiliations}</p>
            )}

            <div className="flex gap-4 flex-wrap">
              {frontmatter.scholar_url && (
                <a
                  href={frontmatter.scholar_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:underline"
                >
                  <ExternalLink className="w-5 h-5" />
                  View on Google Scholar
                </a>
              )}

              {frontmatter.website && (
                <a
                  href={frontmatter.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:underline"
                >
                  <LinkIcon className="w-5 h-5" />
                  Website
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
          <div className="flex items-center gap-3 mb-2">
            <Award className="w-6 h-6 text-blue-600" />
            <h3 className="text-sm font-medium text-blue-900">H-Index</h3>
          </div>
          <p className="text-3xl font-bold text-blue-600">
            {frontmatter.h_index ?? 'N/A'}
          </p>
        </div>

        <div className="bg-green-50 rounded-lg p-6 border border-green-200">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-6 h-6 text-green-600" />
            <h3 className="text-sm font-medium text-green-900">Total Citations</h3>
          </div>
          <p className="text-3xl font-bold text-green-600">
            {frontmatter.total_citations?.toLocaleString() ?? 'N/A'}
          </p>
        </div>

        <div className="bg-purple-50 rounded-lg p-6 border border-purple-200">
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="w-6 h-6 text-purple-600" />
            <h3 className="text-sm font-medium text-purple-900">Publications</h3>
          </div>
          <p className="text-3xl font-bold text-purple-600">
            {frontmatter.total_articles ?? 'N/A'}
          </p>
        </div>

        <div className="bg-orange-50 rounded-lg p-6 border border-orange-200">
          <div className="flex items-center gap-3 mb-2">
            <Award className="w-6 h-6 text-orange-600" />
            <h3 className="text-sm font-medium text-orange-900">i10-Index</h3>
          </div>
          <p className="text-3xl font-bold text-orange-600">
            {frontmatter.i10_index ?? 'N/A'}
          </p>
        </div>
      </div>

      {/* Email */}
      {frontmatter.email && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm font-medium text-gray-700">Email</p>
          <p className="text-base text-gray-900">{frontmatter.email}</p>
        </div>
      )}

      {/* Tags */}
      {frontmatter.tags && frontmatter.tags.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-3">Tags</h3>
          <div className="flex flex-wrap gap-2">
            {frontmatter.tags.map((tag, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm border border-gray-300"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Markdown Body */}
      {body && body.trim().length > 0 && (
        <div className="prose prose-lg max-w-none">
          <ReactMarkdown
            components={{
              h1: ({ node, ...props }) => (
                <h2 className="text-2xl font-bold mt-8 mb-4 text-gray-900" {...props} />
              ),
              h2: ({ node, ...props }) => (
                <h3 className="text-xl font-semibold mt-6 mb-3 text-gray-800" {...props} />
              ),
              h3: ({ node, ...props }) => (
                <h4 className="text-lg font-medium mt-4 mb-2 text-gray-800" {...props} />
              ),
              p: ({ node, ...props }) => (
                <p className="text-base leading-relaxed mb-4 text-gray-700" {...props} />
              ),
              a: ({ node, ...props }) => (
                <a
                  className="text-blue-600 hover:text-blue-800 underline"
                  target="_blank"
                  rel="noopener noreferrer"
                  {...props}
                />
              ),
              ul: ({ node, ...props }) => (
                <ul className="list-disc list-inside mb-4 space-y-2" {...props} />
              ),
              ol: ({ node, ...props }) => (
                <ol className="list-decimal list-inside mb-4 space-y-2" {...props} />
              ),
              li: ({ node, ...props }) => (
                <li className="text-base text-gray-700" {...props} />
              ),
            }}
          >
            {body}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}
