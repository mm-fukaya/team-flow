import React, { useState, useEffect } from 'react';
import { GitHubUser } from '../types';
import { api } from '../services/api';

interface MemberSelectorProps {
  selectedOrg: string;
  selectedMember: string | null;
  onMemberSelect: (member: string) => void;
}

export const MemberSelector: React.FC<MemberSelectorProps> = ({
  selectedOrg,
  selectedMember,
  onMemberSelect
}) => {
  const [members, setMembers] = useState<GitHubUser[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<GitHubUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (selectedOrg) {
      loadMembers();
    }
  }, [selectedOrg]);

  useEffect(() => {
    const filtered = members.filter(member =>
      member.login.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (member.name && member.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredMembers(filtered);
  }, [members, searchTerm]);

  const loadMembers = async () => {
    setIsLoading(true);
    try {
      const membersData = await api.getMembers(selectedOrg);
      setMembers(membersData);
      
      // メンバーが見つからない場合はデモデータを表示
      if (membersData.length === 0) {
        console.log('No members found, showing demo data');
        const demoMembers: GitHubUser[] = [
          {
            id: 1,
            login: 'demo-user1',
            name: 'Demo User 1',
            avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4'
          },
          {
            id: 2,
            login: 'demo-user2',
            name: 'Demo User 2',
            avatar_url: 'https://avatars.githubusercontent.com/u/2?v=4'
          },
          {
            id: 3,
            login: 'demo-user3',
            name: 'Demo User 3',
            avatar_url: 'https://avatars.githubusercontent.com/u/3?v=4'
          }
        ];
        setMembers(demoMembers);
      }
    } catch (error) {
      console.error('Error loading members:', error);
      // エラーの場合もデモデータを表示
      const demoMembers: GitHubUser[] = [
        {
          id: 1,
          login: 'demo-user1',
          name: 'Demo User 1',
          avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4'
        },
        {
          id: 2,
          login: 'demo-user2',
          name: 'Demo User 2',
          avatar_url: 'https://avatars.githubusercontent.com/u/2?v=4'
        },
        {
          id: 3,
          login: 'demo-user3',
          name: 'Demo User 3',
          avatar_url: 'https://avatars.githubusercontent.com/u/3?v=4'
        }
      ];
      setMembers(demoMembers);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMemberClick = (member: GitHubUser) => {
    onMemberSelect(member.login);
    setIsOpen(false);
    setSearchTerm('');
  };

  const selectedMemberData = members.find(m => m.login === selectedMember);

  return (
    <div className="member-selector">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        メンバーを選択
      </label>
      <div className="relative">
        <div
          className="w-full p-3 border border-gray-300 rounded-md bg-white cursor-pointer flex items-center justify-between"
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="flex items-center">
            {selectedMemberData && (
              <img
                src={selectedMemberData.avatar_url}
                alt={selectedMemberData.login}
                className="w-6 h-6 rounded-full mr-2"
              />
            )}
            <span className="text-gray-900">
              {selectedMemberData ? (selectedMemberData.name || selectedMemberData.login) : 'メンバーを選択してください'}
            </span>
          </div>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
            <div className="p-2">
              <input
                type="text"
                placeholder="メンバーを検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            
            {isLoading ? (
              <div className="p-4 text-center text-gray-500">読み込み中...</div>
            ) : filteredMembers.length === 0 ? (
              <div className="p-4 text-center text-gray-500">メンバーが見つかりません</div>
            ) : (
              <div className="max-h-48 overflow-auto">
                {filteredMembers.map((member) => (
                  <div
                    key={member.login}
                    className="p-3 hover:bg-gray-100 cursor-pointer flex items-center"
                    onClick={() => handleMemberClick(member)}
                  >
                    <img
                      src={member.avatar_url}
                      alt={member.login}
                      className="w-6 h-6 rounded-full mr-3"
                    />
                    <div>
                      <div className="font-medium text-gray-900">
                        {member.name || member.login}
                      </div>
                      {member.name && (
                        <div className="text-sm text-gray-500">@{member.login}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}; 